
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot,
  query,
  orderBy,
  where,
  deleteDoc,
  updateDoc
} from "firebase/firestore";
import { FIREBASE_CONFIG } from "../constants";

let db: any = null;

try {
  // Solo inicializa si la config es válida
  if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY") {
    const app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
  }
} catch (e) {
  console.warn("Error al inicializar Firebase:", e);
}

export const isFirebaseActive = () => !!db;

// Sincronizar cualquier colección con un callback
export const syncCollection = (collName: string, callback: (data: any[]) => void, queryConstraints: any[] = []) => {
  if (!db) return;
  const q = query(collection(db, collName), ...queryConstraints);
  return onSnapshot(q, 
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    },
    (error) => {
      if (error.code === 'permission-denied') {
        console.error(`Error de permisos en ${collName}: Revisa las reglas en la consola de Firebase.`);
      }
    }
  );
};

// Sincronizar un documento específico (perfil de usuario)
export const syncDoc = (collName: string, docId: string, callback: (data: any) => void) => {
  if (!db) return;
  return onSnapshot(doc(db, collName, docId), 
    (doc) => {
      if (doc.exists()) callback({ id: doc.id, ...doc.data() });
    },
    (error) => {
      console.error("Error al sincronizar documento:", error);
    }
  );
};

// Guardar o actualizar documento
export const saveToCloud = async (collName: string, docId: string, data: any) => {
  if (!db) return;
  try {
    await setDoc(doc(db, collName, docId), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      alert("⚠️ ERROR DE FIREBASE: Tus reglas de seguridad bloquean la escritura. Ve a la consola de Firebase > Firestore > Reglas y pega las reglas que te proporcioné.");
    }
    throw error;
  }
};

// Borrar documento
export const deleteFromCloud = async (collName: string, docId: string) => {
  if (!db) return;
  try {
    await deleteDoc(doc(db, collName, docId));
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      alert("⚠️ ERROR DE SEGURIDAD: No tienes permiso para borrar este documento en la base de datos.");
    }
    throw error;
  }
};
