/**
 * db.js
 * -----------------------------------------------------------------------
 * Camada de acesso a dados sobre o Firestore. Mantém a MESMA "forma" de
 * API que o sistema tinha no Apps Script (dbGetAll, dbGetById, dbQuery,
 * dbInsert, dbUpdate, dbExcluirLogico, dbDelete) — só que agora tudo é
 * assíncrono (usa await), porque o navegador fala direto com o Firestore,
 * sem passar por um servidor no meio.
 *
 * IMPORTANTE: diferente do Google Sheets, o Firestore guarda os tipos de
 * verdade (número é número, booleano é booleano) — então não precisamos
 * mais daquela função ehVerdadeiro() nem de conversões de String() pra
 * comparar. Isso elimina uma classe inteira de bugs que tivemos antes.
 * -----------------------------------------------------------------------
 */

/** Gera um ID único no formato PREFIXO-TIMESTAMP36-RANDOM. */
function gerarId(prefixo) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const aleatorio = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefixo || 'ID'}-${timestamp}-${aleatorio}`;
}

/** Lê todos os documentos de uma coleção. */
async function dbGetAll(colecao) {
  const snap = await db.collection(colecao).get();
  return snap.docs.map(doc => Object.assign({ ID: doc.id }, doc.data()));
}

/** Busca um único documento pelo ID. Retorna null se não encontrar. */
async function dbGetById(colecao, id) {
  if (!id) return null;
  const doc = await db.collection(colecao).doc(String(id)).get();
  return doc.exists ? Object.assign({ ID: doc.id }, doc.data()) : null;
}

/**
 * Busca documentos que casem com um filtro simples de igualdade.
 * filtro = { EMPRESA_ID: 'xxx', STATUS: 'Ativo' }
 * Para coleções pequenas/médias (o volume normal de uma loja), isso é
 * rápido e simples de manter.
 */
async function dbQuery(colecao, filtro) {
  let ref = db.collection(colecao);
  if (filtro) {
    Object.keys(filtro).forEach(chave => { ref = ref.where(chave, '==', filtro[chave]); });
  }
  const snap = await ref.get();
  return snap.docs.map(doc => Object.assign({ ID: doc.id }, doc.data()));
}

/**
 * Insere um novo documento. Gera ID automaticamente (prefixo baseado no
 * nome da coleção) se "dados.ID" não for informado.
 */
async function dbInsert(colecao, dados, chavesUnicas) {
  const registro = Object.assign({}, dados);
  const id = registro.ID || gerarId(colecao.substring(0, 3));
  delete registro.ID;

  if (chavesUnicas && chavesUnicas.length) {
    for (const chave of chavesUnicas) {
      if (registro[chave] !== undefined && registro[chave] !== '') {
        const existentes = await dbQuery(colecao, { [chave]: registro[chave] });
        if (existentes.length) throw new Error(`Já existe um registro em "${colecao}" com ${chave} = "${registro[chave]}".`);
      }
    }
  }

  await db.collection(colecao).doc(id).set(registro);
  return Object.assign({ ID: id }, registro);
}

/** Atualiza campos de um documento (merge parcial — só sobrescreve o que for passado). */
async function dbUpdate(colecao, id, dadosParciais) {
  const existe = await dbGetById(colecao, id);
  if (!existe) return null;
  await db.collection(colecao).doc(String(id)).set(dadosParciais, { merge: true });
  return Object.assign({}, existe, dadosParciais);
}

/** Exclusão lógica (recomendada): marca STATUS = 'Excluído' em vez de apagar o documento. */
async function dbExcluirLogico(colecao, id) {
  return dbUpdate(colecao, id, { STATUS: 'Excluído' });
}

/** Exclusão física — remove o documento de verdade. Usar com cautela. */
async function dbDelete(colecao, id) {
  const existe = await dbGetById(colecao, id);
  if (!existe) return false;
  await db.collection(colecao).doc(String(id)).delete();
  return true;
}
