/**
 * app.js
 * -----------------------------------------------------------------------
 * Lógica do painel: alterna entre tela de login e o shell (usando o
 * próprio estado de autenticação do Firebase — sem gambiarra de
 * document.write nem localStorage manual), navegação entre módulos
 * (carregados via fetch de arquivos .html estáticos), tema claro/escuro,
 * recolher menu e logout.
 * -----------------------------------------------------------------------
 */

const NOMES_MODULO = {
  DASHBOARD:'Dashboard', AGENDA:'Agenda', CLIENTES:'Clientes', PRODUTOS:'Produtos', FORNECEDORES:'Fornecedores',
  FUNCIONARIOS:'Funcionários', EMPRESAS:'Empresas', VENDAS:'Vendas (PDV)', ORCAMENTOS:'Orçamentos',
  COMPRAS:'Compras', ESTOQUE:'Estoque', ASSISTENCIA:'Assistência técnica', GARANTIAS:'Garantias',
  FINANCEIRO:'Financeiro', RELATORIOS:'Relatórios', CONFIGURACOES:'Configurações', CELULARES:'Celulares', DIVERGENCIAS_ESTOQUE:'Divergências de Estoque', CONTROLE_PONTO:'Controle de Ponto'
};

// ---------- Toast global ----------
function mostrarToast(mensagem, tipo){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast' + (tipo === 'erro' ? ' err' : '');
  el.textContent = mensagem;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ---------- Loja ativa (filtro global) ----------
window.lojaAtivaId = sessionStorage.getItem('bstyle_loja_ativa') || '';

async function popularSeletorLoja(){
  const sel = document.getElementById('seletorLojaGlobal');
  try {
    const empresas = await dbGetAll('EMPRESAS');
    sel.innerHTML = '<option value="">Todas as lojas</option>' + empresas.map(e => `<option value="${e.ID}">${e.NOME}</option>`).join('');
    sel.value = window.lojaAtivaId || '';
  } catch (e) { /* silencioso — se falhar, o filtro só fica em "Todas as lojas" */ }

  if (!window.__seletorLojaWired) {
    window.__seletorLojaWired = true;
    sel.addEventListener('change', () => {
      window.lojaAtivaId = sel.value;
      sessionStorage.setItem('bstyle_loja_ativa', sel.value);
      mostrarToast(sel.value ? 'Mostrando dados de: ' + sel.options[sel.selectedIndex].text : 'Mostrando todas as lojas');
      window.recarregarModuloAtual();
    });
  }
}

/**
 * Mostra um seletor de loja obrigatório (usado quando o filtro geral está
 * em "Todas as lojas" mas a ação precisa saber pra qual loja específica é
 * — ex.: registrar uma venda, uma compra, ou cadastrar um produto novo).
 * Retorna o ID da empresa escolhida, ou null se o usuário cancelar.
 */
window.escolherLoja = function(titulo){
  return new Promise(async (resolve) => {
    let empresas = [];
    try { empresas = await dbGetAll('EMPRESAS'); } catch (e) {}
    if (!empresas.length) { mostrarToast('Cadastre uma loja em Empresas primeiro.', 'erro'); resolve(null); return; }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(3,5,8,0.7); display:flex; align-items:center; justify-content:center; z-index:500; padding:20px;';
    overlay.innerHTML = `<div style="background:var(--bg-surface); border:1px solid var(--hairline); border-radius:14px; padding:24px; min-width:280px; max-width:360px;">
      <h3 style="font-family:var(--font-display); margin:0 0 6px; font-size:16px;">${titulo || 'Para qual loja?'}</h3>
      <p style="color:var(--text-secondary); font-size:12px; margin:0 0 14px;">O filtro está em "Todas as lojas" — escolha uma loja específica para esta ação.</p>
      <div id="listaLojasEscolha"></div>
      <button class="btn" id="btnCancelarEscolhaLoja" style="width:100%; margin-top:8px;">Cancelar</button>
    </div>`;
    document.body.appendChild(overlay);

    const lista = overlay.querySelector('#listaLojasEscolha');
    empresas.forEach(e => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.style.cssText = 'display:block; width:100%; margin-bottom:8px; text-align:left;';
      btn.textContent = e.NOME;
      btn.addEventListener('click', () => { document.body.removeChild(overlay); resolve(e.ID); });
      lista.appendChild(btn);
    });
    overlay.querySelector('#btnCancelarEscolhaLoja').addEventListener('click', () => { document.body.removeChild(overlay); resolve(null); });
  });
};

/** Retorna a loja ativa do filtro global, ou pede pra escolher se estiver em "Todas". */
window.obterLojaParaAcao = async function(titulo){
  if (window.lojaAtivaId) return window.lojaAtivaId;
  return await window.escolherLoja(titulo);
};

// ---------- Alterna login <-> painel conforme o Firebase Auth ----------
auth.onAuthStateChanged(async (user) => {
  const telaLogin = document.getElementById('tela-login');
  const telaApp = document.getElementById('tela-app');

  if (!user) {
    telaApp.classList.remove('ativo');
    telaLogin.style.display = 'grid';
    return;
  }

  try {
    await _carregarUsuarioAtual(user.uid);
    if (usuarioAtual.STATUS !== 'Ativo') {
      mostrarToast('Usuário inativo. Contate o administrador.', 'erro');
      await fazerLogout();
      return;
    }
    document.getElementById('avatarBtn').textContent = (usuarioAtual.NOME || usuarioAtual.EMAIL || '?').substring(0,1).toUpperCase();
    telaLogin.style.display = 'none';
    telaApp.classList.add('ativo');
    await popularSeletorLoja();
    carregarModulo('DASHBOARD');
  } catch (e) {
    mostrarToast('Erro ao carregar seu usuário: ' + e.message, 'erro');
    await fazerLogout();
  }
});

// ---------- Formulário de login ----------
const form = document.getElementById('loginForm');
const btnSubmit = document.getElementById('btnSubmit');
const btnLabel = document.getElementById('btnLabel');
const alertBox = document.getElementById('alertBox');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.classList.remove('show');
  btnSubmit.disabled = true;
  btnLabel.textContent = 'Entrando…';

  try {
    await fazerLogin(document.getElementById('email').value, document.getElementById('senha').value);
  } catch (err) {
    alertBox.textContent = _mensagemAmigavelFirebase(err);
    alertBox.classList.add('show');
  } finally {
    btnSubmit.disabled = false;
    btnLabel.textContent = 'Entrar';
  }
});

document.getElementById('linkEsqueci').addEventListener('click', async () => {
  const email = prompt('Informe seu email cadastrado para recuperação de senha:');
  if (!email) return;
  try {
    await solicitarRecuperacaoSenha(email);
    alert('Se o email existir, você vai receber um link de redefinição de senha.');
  } catch (e) {
    alert('Erro: ' + _mensagemAmigavelFirebase(e));
  }
});

function _mensagemAmigavelFirebase(err){
  const codigo = err && err.code;
  const mapa = {
    'auth/invalid-credential': 'Email ou senha incorretos.',
    'auth/wrong-password': 'Email ou senha incorretos.',
    'auth/user-not-found': 'Email ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas — aguarde alguns minutos e tente de novo.',
    'auth/invalid-email': 'Email inválido.'
  };
  return mapa[codigo] || (err && err.message) || 'Erro desconhecido.';
}

// ---------- Navegação entre módulos ----------
document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    carregarModulo(item.getAttribute('data-modulo'));
  });
});

async function carregarModulo(modulo){
  document.getElementById('crumbAtual').textContent = NOMES_MODULO[modulo] || modulo;
  const content = document.getElementById('content');
  content.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-tertiary);font-family:var(--font-mono);font-size:12.5px;">carregando ' + (NOMES_MODULO[modulo]||modulo).toLowerCase() + '…</div>';

  try {
    const podeVer = await checarPermissao(modulo, 'VISUALIZAR');
    if (!podeVer) {
      content.innerHTML = '<div style="padding:40px;color:var(--red);">Você não tem permissão para ver este módulo.</div>';
      return;
    }

    const resp = await fetch('modules/' + modulo.toLowerCase() + '.html');
    if (!resp.ok) throw new Error('Módulo ainda não foi construído (' + resp.status + ').');
    // Usar resp.text() aqui deixa o navegador "adivinhar" a codificação a partir do
    // cabeçalho que o servidor manda — e o GitHub Pages nem sempre declara UTF-8
    // certinho pra arquivos .html, o que corrompia emojis e acentos (viravam "�").
    // Lendo os bytes crus e decodificando como UTF-8 na mão, isso nunca depende
    // do que o servidor disser.
    const bytes = await resp.arrayBuffer();
    const html = new TextDecoder('utf-8').decode(bytes);
    injetarConteudo(html);
  } catch (e) {
    content.innerHTML = '<div style="padding:40px;color:var(--red);">Erro ao carregar módulo: ' + e.message + '</div>';
  }
}

/** innerHTML não executa <script> — recria cada um para rodar de verdade. */
function injetarConteudo(html){
  const content = document.getElementById('content');
  content.innerHTML = html;
  content.querySelectorAll('script').forEach(antigo => {
    const novo = document.createElement('script');
    if (antigo.src) novo.src = antigo.src; else novo.textContent = antigo.textContent;
    antigo.replaceWith(novo);
  });
}

// ---------- Recolher sidebar (desktop) ----------
document.getElementById('btnCollapse').addEventListener('click', () => {
  const app = document.getElementById('app');
  app.classList.toggle('collapsed');
  document.getElementById('btnCollapse').textContent = app.classList.contains('collapsed') ? '›' : '‹ Recolher';
});

// ---------- Menu-gaveta (celular) ----------
function abrirMenuMobile(){
  document.querySelector('.sidebar').classList.add('aberta');
  document.getElementById('sidebarBackdrop').classList.add('aberta');
}
function fecharMenuMobile(){
  document.querySelector('.sidebar').classList.remove('aberta');
  document.getElementById('sidebarBackdrop').classList.remove('aberta');
}
document.getElementById('btnHamburguer').addEventListener('click', abrirMenuMobile);
document.getElementById('sidebarBackdrop').addEventListener('click', fecharMenuMobile);
// Fecha o menu automaticamente ao escolher um módulo no celular
document.querySelectorAll('.menu-item').forEach(item => item.addEventListener('click', fecharMenuMobile));

// ---------- Tema claro/escuro ----------
document.getElementById('btnTheme').addEventListener('click', () => {
  const html = document.documentElement;
  const novo = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', novo);
  document.getElementById('btnTheme').textContent = novo === 'dark' ? '☾' : '☀';
});

// ---------- Logout ----------
document.getElementById('btnLogout').addEventListener('click', () => fazerLogout());

// Deixa acessível para os módulos (mesmo padrão de antes)
window.mostrarToast = mostrarToast;
window.recarregarModuloAtual = () => {
  const ativo = document.querySelector('.menu-item.active');
  if (ativo) carregarModulo(ativo.getAttribute('data-modulo'));
};

/**
 * Escreve innerHTML só se o elemento realmente existir. Evita o erro
 * "Cannot set properties of null" que acontecia quando o usuário trocava
 * de aba antes de uma busca assíncrona terminar (o elemento da aba
 * antiga já não existe mais quando a resposta chega).
 */
/**
 * Carrega assets/img/Logo.png como data URL (necessário pro jsPDF.addImage).
 * Devolve { url, largura, altura } com o tamanho REAL da imagem, pra quem for
 * desenhar ela saber a proporção certa e não espremer num quadrado.
 * Se a logo não existir/falhar, resolve null — quem chamar deve seguir sem logo.
 */
window.carregarLogoComoDataUrl = function(){
  return new Promise((resolve) => {
    let jaResolveu = false;
    const finalizar = (valor) => { if (!jaResolveu) { jaResolveu = true; resolve(valor); } };

    const img = new Image();
    // Sem crossOrigin aqui de propósito: a logo é do mesmo site (mesma origem),
    // então não precisa de CORS — pedir isso à toa pode até fazer a imagem
    // falhar em cache, dependendo de como o navegador já carregou ela antes.
    img.onload = () => {
      try {
        // A logo original é bem grande (pensada pra tela) — nos documentos ela
        // nunca aparece maior que uns 30mm, então reduzir aqui evita PDFs gigantes
        // (cada via embute a imagem de novo; sem isso, o arquivo passava de 10-15 MB).
        const MAX_LADO = 500;
        const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
        const largura = Math.round(img.width * escala), altura = Math.round(img.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = largura; canvas.height = altura;
        canvas.getContext('2d').drawImage(img, 0, 0, largura, altura);
        finalizar({ url: canvas.toDataURL('image/png'), largura: img.width, altura: img.height });
      } catch (e) { finalizar(null); }
    };
    img.onerror = () => finalizar(null);
    img.src = 'assets/img/Logo.png';

    setTimeout(() => finalizar(null), 2500); // não deixa travar pra sempre se a imagem nunca responder
  });
}

/**
 * Desenha o cabeçalho padrão dos documentos: logo + nome da marca à esquerda,
 * as lojas cadastradas (até 2) lado a lado à direita, e uma barra de degradê
 * embaixo — igual ao layout usado na impressão HTML dos termos, pra ficar tudo
 * padronizado (sem caixa com borda, visual mais limpo).
 * Retorna a posição Y (em mm) onde o conteúdo do documento pode continuar.
 */
window.desenharCabecalhoLoja = async function(doc, empresasList){
  const lojas = (empresasList || []).slice(0, 2);

  let logoOk = false;
  try {
    const logo = await carregarLogoComoDataUrl();
    if (logo) {
      // Área reservada pra logo: até 30mm de largura x 24mm de altura — encaixa
      // a imagem dentro disso mantendo a proporção real, sem espremer em quadrado.
      const areaLargura = 30, areaAltura = 24;
      const proporcao = logo.largura / logo.altura;
      let larguraFinal = areaLargura, alturaFinal = areaLargura / proporcao;
      if (alturaFinal > areaAltura) { alturaFinal = areaAltura; larguraFinal = areaAltura * proporcao; }
      const x = 15, y = 10 + (areaAltura - alturaFinal) / 2;
      doc.addImage(logo.url, 'PNG', x, y, larguraFinal, alturaFinal);
      logoOk = true;
    }
  } catch (e) { /* segue sem logo, não trava a geração do PDF */ }

  const xMarca = logoOk ? 48 : 15;
  const larguraDisponivelMarca = 97 - xMarca; // até pouco antes da coluna das lojas (x=100)
  const nomeMarca = 'BSTYLE - Eletrônicos & Acessórios';
  doc.setFont(undefined, 'bold'); doc.setTextColor(226, 64, 28);
  let tamanhoFonteMarca = 15;
  doc.setFontSize(tamanhoFonteMarca);
  while (tamanhoFonteMarca > 11 && doc.getTextWidth(nomeMarca) > larguraDisponivelMarca) {
    tamanhoFonteMarca -= 0.5;
    doc.setFontSize(tamanhoFonteMarca);
  }
  if (doc.getTextWidth(nomeMarca) > larguraDisponivelMarca) {
    // Mesmo no tamanho mínimo não coube numa linha — quebra em duas, garantido que não invade a coluna das lojas.
    doc.text('BSTYLE - Eletrônicos', xMarca, 16);
    doc.text('& Acessórios', xMarca, 21);
    doc.setFontSize(8.5); doc.setFont(undefined, 'normal'); doc.setTextColor(90);
    doc.text((lojas[0] && lojas[0].EMAIL) || (lojas[0] && lojas[0].INSTAGRAM) || '', xMarca, 27);
  } else {
    doc.text(nomeMarca, xMarca, 18);
    doc.setFontSize(8.5); doc.setFont(undefined, 'normal'); doc.setTextColor(90);
    doc.text((lojas[0] && lojas[0].EMAIL) || (lojas[0] && lojas[0].INSTAGRAM) || '', xMarca, 24);
  }

  // Lojas cadastradas, lado a lado à direita — mesma info que aparece na impressão.
  const larguraColuna = 43, espacoEntreColunas = 5;
  lojas.forEach((empresa, idx) => {
    const x = 100 + idx * (larguraColuna + espacoEntreColunas);
    let ly = 14;
    doc.setFontSize(8.5); doc.setFont(undefined, 'bold'); doc.setTextColor(20);
    const tituloLoja = doc.splitTextToSize('Loja ' + (idx+1) + ' – ' + [empresa.RUA, empresa.NUMERO].filter(Boolean).join(', '), larguraColuna);
    doc.text(tituloLoja, x, ly); ly += tituloLoja.length * 3.6;
    doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.setTextColor(80);
    const bairroCidade = [empresa.BAIRRO, empresa.CIDADE].filter(Boolean).join(' – ');
    if (bairroCidade) { const linhasBC = doc.splitTextToSize(bairroCidade, larguraColuna); doc.text(linhasBC, x, ly); ly += linhasBC.length * 3.6; }
    doc.text(empresa.WHATSAPP || '—', x, ly);
  });
  if (!lojas.length) { doc.setFontSize(8); doc.setTextColor(150); doc.text('Cadastre suas lojas em Empresas.', 100, 18); }

  // Barra de degradê laranja -> âmbar, separando o cabeçalho do resto do documento
  // (jsPDF não tem gradiente nativo, então desenha várias faixas finas de cor).
  const yBarra = 34, alturaBarra = 1.4, xIni = 15, xFim = 195;
  const corInicio = [226, 64, 28], corFim = [245, 166, 35];
  const passos = 50, larguraFaixa = (xFim - xIni) / passos;
  for (let i = 0; i < passos; i++) {
    const t = i / (passos - 1);
    doc.setFillColor(
      Math.round(corInicio[0] + (corFim[0]-corInicio[0])*t),
      Math.round(corInicio[1] + (corFim[1]-corInicio[1])*t),
      Math.round(corInicio[2] + (corFim[2]-corInicio[2])*t)
    );
    doc.rect(xIni + i*larguraFaixa, yBarra, larguraFaixa + 0.15, alturaBarra, 'F');
  }

  doc.setTextColor(20);
  return 44;
};

/**
 * Fecha qualquer modal aberto (padrão .modal-overlay.open, usado em todas as
 * abas) ao apertar Esc — funciona em qualquer módulo, sem precisar de código
 * repetido em cada um. Fecha só o de cima, se houver mais de um empilhado.
 */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const abertos = document.querySelectorAll('.modal-overlay.open');
  if (!abertos.length) return;
  abertos[abertos.length - 1].classList.remove('open');
});

window.setHTML = function(id, html){
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
  return el;
};

/**
 * Converte uma data-string "YYYY-MM-DD" (vinda de <input type="date">) pro
 * dia LOCAL correto. Sem isso, new Date("2026-07-06") é lido como meia-noite
 * em UTC, e no fuso do Brasil (UTC-3) isso vira 21h do dia ANTERIOR — fazendo
 * qualquer calendário/prazo aparecer um dia adiantado. Use esta função
 * sempre que comparar ou exibir um campo de data-só (sem hora).
 */
window.parseDataLocal = function(str){
  if (!str) return null;
  const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date(str);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};
