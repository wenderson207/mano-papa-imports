/**
 * auth.js
 * -----------------------------------------------------------------------
 * Login, logout, verificação de permissões e criação de funcionários,
 * usando Firebase Authentication (em vez do sistema de senha/sessão
 * feito à mão que tínhamos no Apps Script). O Firebase cuida de guardar
 * a sessão entre recarregamentos de página sozinho — não precisa mais de
 * localStorage manual nem de token indo e voltando.
 * -----------------------------------------------------------------------
 */

const MODULOS_SISTEMA = [
  'DASHBOARD', 'CAIXA', 'AGENDA', 'EMPRESAS', 'FUNCIONARIOS', 'CLIENTES', 'PRODUTOS', 'CELULARES', 'ESTOQUE',
  'PEDIDOS', 'DIVERGENCIAS_ESTOQUE', 'COMPRAS', 'FORNECEDORES', 'VENDAS', 'ORCAMENTOS', 'ASSISTENCIA', 'GARANTIAS',
  'CONTROLE_PONTO', 'FINANCEIRO', 'RELATORIOS', 'CONFIGURACOES'
];
const PERFIS_PADRAO = ['Administrador', 'Gerente', 'Financeiro', 'Vendedor', 'Técnico', 'Estoquista'];

let usuarioAtual = null; // cache em memória do documento USUARIOS da pessoa logada
let _cachePerfilAdmin = {}; // cache simples de "esse PERFIL_ID é Administrador?" nesta sessão do navegador

/** Login por email e senha via Firebase Authentication. */
async function fazerLogin(email, senha) {
  const cred = await auth.signInWithEmailAndPassword(String(email).trim().toLowerCase(), senha);
  await _carregarUsuarioAtual(cred.user.uid);
  if (usuarioAtual.STATUS !== 'Ativo') {
    await auth.signOut();
    throw new Error('Usuário inativo. Contate o administrador.');
  }
  await dbUpdate('USUARIOS', usuarioAtual.ID, { ULTIMO_ACESSO: new Date().toISOString() });
  return usuarioAtual;
}

async function _carregarUsuarioAtual(uid) {
  const doc = await dbGetById('USUARIOS', uid);
  if (!doc) throw new Error('Login autenticado, mas não existe cadastro em USUARIOS para essa conta. Rode o seed inicial (seed.html) ou contate o administrador.');
  usuarioAtual = doc;
  return usuarioAtual;
}

function fazerLogout() {
  usuarioAtual = null;
  _cachePerfilAdmin = {};
  return auth.signOut();
}

/** Envia email de redefinição de senha (fluxo pronto do Firebase — sem código manual). */
function solicitarRecuperacaoSenha(email) {
  return auth.sendPasswordResetEmail(String(email).trim().toLowerCase());
}

async function perfilEhAdministrador(perfilId) {
  if (!perfilId) return false;
  if (perfilId in _cachePerfilAdmin) return _cachePerfilAdmin[perfilId];
  const perfil = await dbGetById('PERFIS', perfilId);
  const resultado = !!(perfil && String(perfil.NOME).trim().toLowerCase() === 'administrador');
  _cachePerfilAdmin[perfilId] = resultado;
  return resultado;
}

/**
 * Administrador sempre tem acesso total. Pra todo mundo, o acesso não é mais
 * por CARGO/PERFIL — é uma lista de abas liberadas direto no cadastro de
 * cada funcionário (campo MODULOS_PERMITIDOS). Uma vez que a aba está
 * liberada, o funcionário pode fazer tudo nela (ver, cadastrar, editar,
 * excluir) — não tem mais controle fino por ação dentro do módulo.
 */
async function checarPermissao(modulo, acao) {
  if (!usuarioAtual) return false;
  if (modulo === 'AJUDA') return true; // ajuda/suporte fica liberado pra todo mundo, sempre
  if (await perfilEhAdministrador(usuarioAtual.PERFIL_ID)) return true;

  const permitidos = usuarioAtual.MODULOS_PERMITIDOS || [];
  return permitidos.includes(modulo);
}

/**
 * Cria um novo funcionário COM login (email/senha), sem deslogar o
 * administrador que está criando. Usa uma instância secundária e
 * temporária do Firebase só para o cadastro — truque padrão para criar
 * usuários pelo navegador sem precisar de servidor por trás.
 */
async function criarFuncionarioComLogin(dados, senhaInicial) {
  const nomeAppTemp = 'app-temporario-' + Date.now();
  const appTemp = firebase.initializeApp(firebaseConfig, nomeAppTemp);

  try {
    const cred = await appTemp.auth().createUserWithEmailAndPassword(
      String(dados.EMAIL).trim().toLowerCase(), senhaInicial
    );
    const uid = cred.user.uid;

    const registro = {
      NOME: dados.NOME, EMAIL: String(dados.EMAIL).trim().toLowerCase(),
      CARGO: dados.CARGO || '', TELEFONE: dados.TELEFONE || '',
      PERFIL_ID: dados.PERFIL_ID || '', EMPRESA_ID: dados.EMPRESA_ID || '',
      MODULOS_PERMITIDOS: Array.isArray(dados.MODULOS_PERMITIDOS) ? dados.MODULOS_PERMITIDOS : [],
      STATUS: 'Ativo', DATA_ADMISSAO: dados.DATA_ADMISSAO || new Date().toISOString(),
      OBSERVACOES: dados.OBSERVACOES || '', DATA_CRIACAO: new Date().toISOString()
    };
    await db.collection('USUARIOS').doc(uid).set(registro);
    await appTemp.auth().signOut();

    return Object.assign({ ID: uid }, registro);
  } finally {
    await appTemp.delete(); // sempre limpa a instância temporária, mesmo se der erro
  }
}

/** Redefine a senha de um funcionário — precisa ser feito pelo próprio usuário via link de email. */
function redefinirSenhaFuncionario(email) {
  return solicitarRecuperacaoSenha(email);
}
