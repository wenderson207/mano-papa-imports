/**
 * firebase-init.js
 * -----------------------------------------------------------------------
 * Configuração e inicialização do Firebase. Esses valores (apiKey, etc.)
 * NÃO são segredo — eles só identificam qual projeto Firebase o site usa.
 * A segurança de verdade vem das Regras de Segurança do Firestore
 * (firestore.rules) + Firebase Authentication, não de esconder isto aqui.
 * -----------------------------------------------------------------------
 */
const firebaseConfig = {
  apiKey: "AIzaSyCxWovMBgicwnEK2yzyYHm7clDeIO-m4vU",
  authDomain: "bstyle-ab14a.firebaseapp.com",
  projectId: "bstyle-ab14a",
  storageBucket: "bstyle-ab14a.firebasestorage.app",
  messagingSenderId: "1065822284388",
  appId: "1:1065822284388:web:1a00706fd06ae4a35ccd71"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Mantém o login mesmo depois de fechar/recarregar o navegador (Firebase cuida disso sozinho).
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
