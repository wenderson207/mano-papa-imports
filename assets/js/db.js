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
 *
 * CACHE: cada troca de aba antes buscava tudo de novo do Firestore, o que
 * gastava a cota diária de leituras muito rápido. Agora, dbGetAll guarda o
 * resultado por 45 segundos — trocar de aba e voltar não gasta leitura
 * nova nesse intervalo. Qualquer escrita (inserir/atualizar/excluir) na
 * coleção invalida o cache dela na hora, então você sempre vê o dado
 * fresco depois de salvar algo — o cache nunca mostra informação velha
 * por causa disso, só evita reler o que não mudou.
 * -----------------------------------------------------------------------
 */

/** Gera um ID único no formato PREFIXO-TIMESTAMP36-RANDOM. */
function gerarId(prefixo) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const aleatorio = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefixo || 'ID'}-${timestamp}-${aleatorio}`;
}

const TEMPO_CACHE_MS = 45000; // 45 segundos
const _cacheColecoes = {}; // { colecao: { dados: [...], quando: timestampMs } }
const _cacheConsultas = {}; // { 'colecao|filtroJSON': { dados: [...], quando: timestampMs } } -- cache das buscas filtradas (dbQuery), separado do cache de coleção inteira pra não misturar resultado parcial com resultado completo

function _cacheValido(colecao) {
  const entrada = _cacheColecoes[colecao];
  return entrada && (Date.now() - entrada.quando) < TEMPO_CACHE_MS;
}

/** Limpa o cache de uma coleção (chamado sempre que ela é escrita) — tanto
 * o cache de "coleção inteira" quanto qualquer busca filtrada guardada dela. */
function _invalidarCache(colecao) {
  delete _cacheColecoes[colecao];
  Object.keys(_cacheConsultas).forEach(chave => { if (chave.startsWith(colecao + '|')) delete _cacheConsultas[chave]; });
}
window.invalidarCache = _invalidarCache; // exposto pra debug manual, se precisar

/** Lê todos os documentos de uma coleção — usa cache quando disponível. */
async function dbGetAll(colecao) {
  if (_cacheValido(colecao)) return _cacheColecoes[colecao].dados.map(d => Object.assign({}, d));
  const snap = await db.collection(colecao).get();
  const dados = snap.docs.map(doc => Object.assign({ ID: doc.id }, doc.data()));
  _cacheColecoes[colecao] = { dados, quando: Date.now() };
  return dados.map(d => Object.assign({}, d));
}

/**
 * Busca um único documento pelo ID. Se a coleção inteira já estiver em
 * cache (de um dbGetAll recente), usa ela — sem gastar leitura nova.
 * Senão, busca só esse documento (mais barato que trazer a coleção toda
 * à toa).
 */
async function dbGetById(colecao, id) {
  if (!id) return null;
  if (_cacheValido(colecao)) {
    const achado = _cacheColecoes[colecao].dados.find(d => d.ID === String(id));
    return achado ? Object.assign({}, achado) : null;
  }
  const doc = await db.collection(colecao).doc(String(id)).get();
  return doc.exists ? Object.assign({ ID: doc.id }, doc.data()) : null;
}

/**
 * Busca documentos que casem com um filtro simples de igualdade.
 * filtro = { EMPRESA_ID: 'xxx', STATUS: 'Ativo' }
 * Se a coleção já estiver em cache, filtra em memória (sem leitura nova).
 * Senão, faz a consulta direto no Firestore, como antes.
 */
async function dbQuery(colecao, filtro) {
  if (_cacheValido(colecao)) {
    const chaves = Object.keys(filtro || {});
    return _cacheColecoes[colecao].dados
      .filter(d => chaves.every(chave => d[chave] === filtro[chave]))
      .map(d => Object.assign({}, d));
  }
  const chaveConsulta = colecao + '|' + JSON.stringify(filtro || {});
  const entradaConsulta = _cacheConsultas[chaveConsulta];
  if (entradaConsulta && (Date.now() - entradaConsulta.quando) < TEMPO_CACHE_MS) {
    return entradaConsulta.dados.map(d => Object.assign({}, d));
  }
  let ref = db.collection(colecao);
  if (filtro) {
    Object.keys(filtro).forEach(chave => { ref = ref.where(chave, '==', filtro[chave]); });
  }
  const snap = await ref.get();
  const dados = snap.docs.map(doc => Object.assign({ ID: doc.id }, doc.data()));
  _cacheConsultas[chaveConsulta] = { dados, quando: Date.now() };
  return dados.map(d => Object.assign({}, d));
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
  _invalidarCache(colecao);
  return Object.assign({ ID: id }, registro);
}

/** Atualiza campos de um documento (merge parcial — só sobrescreve o que for passado). */
async function dbUpdate(colecao, id, dadosParciais) {
  const existe = await dbGetById(colecao, id);
  if (!existe) return null;
  await db.collection(colecao).doc(String(id)).set(dadosParciais, { merge: true });
  _invalidarCache(colecao);
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
  _invalidarCache(colecao);
  return true;
}
