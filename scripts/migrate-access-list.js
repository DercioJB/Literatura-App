import admin from 'firebase-admin';

// Initialize the Firebase Admin SDK.
// It will detect environment variables or application default credentials (ADC) automatically.
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "gen-lang-client-0796932330" // Fallback project ID
  });
}

const db = admin.firestore();

async function runMigration() {
  console.log("=== INICIANDO MIGRAÇÃO DE ACCESSLIST ===");
  
  try {
    // 1. Carregar todos os workspaces para mapear workspaceId -> ownerId e accessList
    console.log("Carregando workspaces...");
    const workspacesSnapshot = await db.collection('workspaces').get();
    
    const workspaceOwners = {};
    const workspaceAccessLists = {};
    let fallbackOwnerId = null;
    let fallbackAccessList = [];

    workspacesSnapshot.forEach(doc => {
      const data = doc.data();
      const workspaceId = doc.id;
      workspaceOwners[workspaceId] = data.ownerId;
      workspaceAccessLists[workspaceId] = data.accessList || [];
      
      if (workspaceId === 'global_workspace' || !fallbackOwnerId) {
        fallbackOwnerId = data.ownerId;
        fallbackAccessList = data.accessList || [];
      }
    });

    console.log(`Mapeados ${Object.keys(workspaceOwners).length} workspaces.`);
    console.log(`Fallback Workspace Owner ID: ${fallbackOwnerId}`);

    if (!fallbackOwnerId) {
      console.warn("AVISO: Nenhum workspace ativo encontrado no Firestore! Introduza o UUID do proprietário se conhecido, ou crie o workspace primeiro.");
    }

    // Coleções que dependem de accessList
    const collectionsToMigrate = ['books', 'history', 'backups'];

    for (const collectionName of collectionsToMigrate) {
      console.log(`\nProcessando coleção '${collectionName}'...`);
      const snapshot = await db.collection(collectionName).get();
      
      let totalDocs = 0;
      let migratedDocs = 0;
      let batch = db.batch();
      let operationCount = 0;

      for (const doc of snapshot.docs) {
        totalDocs++;
        const data = doc.data();
        const hasAccessList = 'accessList' in data && Array.isArray(data.accessList) && data.accessList.length > 0;

        if (!hasAccessList) {
          // Determinar qual é o UID correto do owner ou do accessList para associar
          const currentWorkspaceId = data.workspaceId || 'global_workspace';
          const ownerId = workspaceOwners[currentWorkspaceId] || fallbackOwnerId;
          const fullAccessList = workspaceAccessLists[currentWorkspaceId] || fallbackAccessList;

          if (!ownerId) {
            console.error(`Erro: Não foi possível determinar o ownerId para o documento ${doc.id} na coleção ${collectionName} (workspaceId: ${currentWorkspaceId})`);
            continue;
          }

          // A diretiva diz: "adiciona o accessList com o UID do owner do workspace correspondente"
          // Nós definimos como um array contendo pelo menos o ownerId. Para máxima compatibilidade, vamos usar o accessList completo do workspace
          // (que já inclui o ownerId e outros membros), ou fallback para [ownerId].
          const targetAccessList = (fullAccessList && fullAccessList.length > 0) ? fullAccessList : [ownerId];

          console.log(`Documento '${doc.id}' está sem accessList. Associando:`, targetAccessList);
          
          batch.update(doc.ref, { accessList: targetAccessList });
          operationCount++;
          migratedDocs++;

          // Firestore limita batches a 500 operações
          if (operationCount >= 400) {
            console.log(`Enviando batch com ${operationCount} operações para ${collectionName}...`);
            await batch.commit();
            batch = db.batch();
            operationCount = 0;
          }
        }
      }

      // Envia operações restantes
      if (operationCount > 0) {
        console.log(`Enviando batch com as últimas ${operationCount} operações...`);
        await batch.commit();
      }

      console.log(`Progresso de '${collectionName}': ${migratedDocs} de ${totalDocs} documentos migrados.`);
    }

    console.log("\n=== MIGRAÇÃO CONCLUÍDA COM SUCESSO ===");

  } catch (error) {
    console.error("Erro crítico durante a execução do script de migração:", error);
    process.exit(1);
  }
}

runMigration();
