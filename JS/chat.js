import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  getFirestore,
  doc, getDoc, setDoc, addDoc, collection, query, orderBy, onSnapshot, serverTimestamp, where
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDsNtYcowBKtJw_doiE_JpV_d0KZaLMqA0",
  authDomain: "marketlocal-e4ab7.firebaseapp.com",
  projectId: "marketlocal-e4ab7",
  storageBucket: "marketlocal-e4ab7.firebasestorage.app",
  messagingSenderId: "257007076578",
  appId: "1:257007076578:web:5e8897d117868494cf8abb"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let chatId = null;
let unsubscribe = null;

// Lấy chatId từ URL (?chat=xxx) hoặc tạo mới
const urlParams = new URLSearchParams(window.location.search);
chatId = urlParams.get('chat');

// Init
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;
  if (chatId) {
    await loadChat();
  } else {
    // Tạo chat mới từ product page
    const listingId = urlParams.get('listing');
    const sellerId = urlParams.get('seller');
    if (listingId && sellerId) {
      chatId = await getOrCreateChat(listingId, sellerId);
      if (chatId) await loadChat();
    }
  }
});

async function getOrCreateChat(listingId, sellerId) {
  // Tìm chat cũ
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', currentUser.uid)
  );

  // Logic tìm chat giữa 2 người + listing (có thể cải tiến sau)
  // Hiện tại dùng cách đơn giản: tạo mới hoặc tìm theo participants
  const chatRef = doc(db, 'chats', `${currentUser.uid}_${sellerId}`); // deterministic ID
  const snap = await getDoc(chatRef);

  if (snap.exists()) return chatRef.id;

  // Tạo mới
  await setDoc(chatRef, {
    participants: [currentUser.uid, sellerId],
    listingId: listingId,
    lastMessage: '',
    lastUpdated: serverTimestamp()
  });

  return chatRef.id;
}

async function loadChat() {
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    alert('Cuộc trò chuyện không tồn tại');
    return;
  }

  const chatData = chatSnap.data();
  renderChatHeader(chatData);

  // Realtime messages
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('createdAt'));

  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(q, (snapshot) => {
    const messagesDiv = document.getElementById('chatMessages');
    messagesDiv.innerHTML = '';

    snapshot.forEach(doc => {
      const msg = doc.data();
      const isMe = msg.senderId === currentUser.uid;

      const msgEl = document.createElement('div');
      msgEl.className = `message ${isMe ? 'message-me' : 'message-other'}`;
      msgEl.innerHTML = `
        <div class="message-bubble">${msg.text}</div>
        <small class="message-time">${formatTime(msg.createdAt?.toDate())}</small>
      `;
      messagesDiv.appendChild(msgEl);
    });

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });

  // Send message
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('messageInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
  });
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !chatId) return;

  const messagesRef = collection(db, 'chats', chatId, 'messages');
  await addDoc(messagesRef, {
    senderId: currentUser.uid,
    text: text,
    createdAt: serverTimestamp(),
    readBy: [currentUser.uid]
  });

  // Update last message in chat
  await setDoc(doc(db, 'chats', chatId), {
    lastMessage: text,
    lastUpdated: serverTimestamp()
  }, { merge: true });

  input.value = '';
}

// Helper functions
function renderChatHeader(chatData) {
  // Load seller name, listing title...
  document.getElementById('chatHeader').innerHTML = `
    <h5>💬 Chat với người bán</h5>
    <small>Listing: ${chatData.listingId || ''}</small>
  `;
}

function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}