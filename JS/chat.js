import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
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
let chatReady = false;
let activeChatData = null;

// Lấy chatId từ URL (?chat=xxx) hoặc tạo mới
const urlParams = new URLSearchParams(window.location.search);
chatId = urlParams.get('chat');

// Init
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = `auth.html?redirect=${encodeURIComponent(window.location.href)}`;
    return;
  }

  currentUser = user;
  setComposerEnabled(false);
  renderChatStatus('Đang mở cuộc trò chuyện...');

  try {
    if (chatId) {
      await loadChat();
      return;
    }

    const listingId = urlParams.get('listing');
    if (!listingId) {
      renderChatError('Thiếu thông tin cuộc trò chuyện.');
      return;
    }

    chatId = await getOrCreateChat(listingId);
    await loadChat();
  } catch (err) {
    console.error('Chat init error:', err);
    renderChatError(errorMessage(err));
  }
});

async function getOrCreateChat(listingId) {
  const listingSnap = await getDoc(doc(db, 'listings', listingId));
  if (!listingSnap.exists()) {
    throw new Error('Tin đăng không tồn tại hoặc đã bị xoá.');
  }

  const listing = { id: listingSnap.id, ...listingSnap.data() };
  const sellerId = listing.ownerId || urlParams.get('seller');
  if (!sellerId) {
    throw new Error('Tin đăng này chưa có thông tin người bán.');
  }
  if (sellerId === currentUser.uid) {
    throw new Error('Bạn không thể tự nhắn tin cho tin đăng của mình.');
  }

  const participants = [currentUser.uid, sellerId].sort();
  const chatRef = doc(db, 'chats', buildChatId(listingId, participants));
  const snap = await getDoc(chatRef);

  if (snap.exists()) return chatRef.id;

  // Tạo mới
  await setDoc(chatRef, {
    participants,
    listingId,
    buyerId: currentUser.uid,
    sellerId,
    listingTitle: listing.title || '',
    listingImage: listing.images?.[0]?.url || '',
    lastMessage: '',
    lastUpdated: serverTimestamp()
  });

  return chatRef.id;
}

async function loadChat() {
  chatReady = false;
  setComposerEnabled(false);

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    renderChatError('Cuộc trò chuyện không tồn tại.');
    return;
  }

  const chatData = chatSnap.data();
  if (!chatData.participants?.includes(currentUser.uid)) {
    renderChatError('Bạn không có quyền xem cuộc trò chuyện này.');
    return;
  }

  activeChatData = chatData;
  await renderChatHeader(chatData);
  chatReady = true;
  setComposerEnabled(true);

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
        <div class="message-bubble">${escHtml(msg.text)}</div>
        <small class="message-time">${formatTime(msg.createdAt?.toDate())}</small>
      `;
      messagesDiv.appendChild(msgEl);
    });

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, (err) => {
    console.error('Messages listener error:', err);
    renderChatError(errorMessage(err));
  });
}

document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
document.getElementById('messageInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !chatId || !chatReady) return;
  setComposerEnabled(false);

  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    await addDoc(messagesRef, {
      senderId: currentUser.uid,
      text,
      createdAt: serverTimestamp(),
      readBy: [currentUser.uid]
    });

    await setDoc(doc(db, 'chats', chatId), {
      lastMessage: text,
      lastSenderId: currentUser.uid,
      lastUpdated: serverTimestamp()
    }, { merge: true });

    input.value = '';
  } catch (err) {
    console.error(err);
    alert(errorMessage(err));
  } finally {
    setComposerEnabled(true);
    input?.focus();
  }
}

// Helper functions
async function renderChatHeader(chatData) {
  const listingSnap = chatData.listingId
    ? await getDoc(doc(db, 'listings', chatData.listingId)).catch(() => null)
    : null;
  const listing = listingSnap?.exists?.() ? listingSnap.data() : null;
  const otherUid = chatData.participants?.find(uid => uid !== currentUser.uid);
  const userSnap = otherUid
    ? await getDoc(doc(db, 'users', otherUid)).catch(() => null)
    : null;
  const other = userSnap?.exists?.() ? userSnap.data() : {};
  const otherName = other.name || chatData.sellerName || listing?.ownerName || 'Người dùng';
  const title = listing?.title || chatData.listingTitle || 'Tin đăng';
  const backUrl = chatData.listingId ? `product.html?id=${encodeURIComponent(chatData.listingId)}` : 'home.html';

  document.getElementById('chatHeader').innerHTML = `
    <a class="chat-back" href="${backUrl}" title="Quay lại tin đăng">
      <i class="ti ti-arrow-left"></i>
    </a>
    <div>
      <h5>Chat với ${escHtml(otherName)}</h5>
      <small>${escHtml(title)}</small>
    </div>
  `;
}

function renderChatStatus(message) {
  document.getElementById('chatHeader').innerHTML = `<h5>${escHtml(message)}</h5>`;
}

function renderChatError(message) {
  document.getElementById('chatHeader').innerHTML = `<h5>${escHtml(message)}</h5>`;
  const messagesDiv = document.getElementById('chatMessages');
  messagesDiv.innerHTML = `
    <div class="chat-error">
      <i class="ti ti-alert-circle"></i>
      <span>${escHtml(message)}</span>
    </div>
  `;
  chatReady = false;
  setComposerEnabled(false);
}

function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function buildChatId(listingId, participants) {
  return [listingId, ...participants].map(encodeChatPart).join('__');
}

function encodeChatPart(value) {
  return encodeURIComponent(String(value)).replace(/\./g, '%2E');
}

function setComposerEnabled(enabled) {
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  if (input) input.disabled = !enabled;
  if (sendBtn) sendBtn.disabled = !enabled;
}

function errorMessage(err) {
  if (err?.code === 'permission-denied') {
    return 'Bạn chưa có quyền dùng chat. Hãy kiểm tra Firestore Rules cho collection chats/messages.';
  }
  return err?.message || 'Chat đang gặp lỗi. Vui lòng thử lại.';
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
