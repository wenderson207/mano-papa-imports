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
  apiKey: "AIzaSyC4wKYB-5TqWDSP-qjW-3iGiRW9nOHuGP8",
  authDomain: "mano-papa.firebaseapp.com",
  projectId: "mano-papa",
  storageBucket: "mano-papa.firebasestorage.app",
  messagingSenderId: "254609927869",
  appId: "1:254609927869:web:8f1f2f1091dd77f7c691d4"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Mantém o login mesmo depois de fechar/recarregar o navegador (Firebase cuida disso sozinho).
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
