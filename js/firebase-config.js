// js/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ========================================
// ВСТАВЬТЕ СЮДА СВОИ ДАННЫЕ ИЗ FIREBASE
// ========================================
const firebaseConfig = {
  apiKey: "AIzaSyBKtm0sqPt3_SeXc2592LPmgH9qqwy1bQ8",
  authDomain: "mango-clicker-b2b88.firebaseapp.com",
  projectId: "mango-clicker-b2b88",
  storageBucket: "mango-clicker-b2b88.firebasestorage.app",
  messagingSenderId: "201769215141",
  appId: "1:201769215141:web:6cfe4c0ff580d8d16a194c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction
};