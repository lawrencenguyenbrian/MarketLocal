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
  where,
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
let unsubscribeMessages = null;
let unsubscribeChatList = null;
let chatReady = false;
let activeChatData = null;
let curatedDataCache = {};

// ── Init ──
const urlParams = new URLSearchParams(window.location.search);
chatId = urlParams.get('chat');

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = `auth.html?redirect=${encodeURIComponent(window.location.href)}`;
    return;
  }

  currentUser = user;

  if (chatId) {
    showConversationView();
    await loadChat();
  } else {
    const listingId = urlParams.get('listing');
    if (listingId) {
      chatId = await getOrCreateChat(listingId);
      showConversationView();
      replaceUrl(chatId);
      await loadChat();
    } else {
      showInboxView();
      loadChatList();
    }
  }
});

// ── URL helpers ──
function replaceUrl(id) {
  const url = new URL(window.location);
  url.searchParams.set('chat', id);
  window.history.replaceState({}, '', url);
}

// ── View switching ──
function showInboxView() {
  document.getElementById('chatSidebar').classList.remove('chat-sidebar-hidden');
  document.getElementById('chatEmpty').style.display = '';
  document.getElementById('chatMain').style.display = 'none';
}

function showConversationView() {
  document.getElementById('chatSidebar').classList.add('chat-sidebar-hidden');
  document.getElementById('chatEmpty').style.display = 'none';
  document.getElementById('chatMain').style.display = '';
}

// ── Inbox: load chat list ──
function loadChatList() {
  const listEl = document.getElementById('chatList');
  listEl.innerHTML = '<div class="chat-list-loading">Đang tải tin nhắn...</div>';

  if (unsubscribeChatList) unsubscribeChatList();

  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', currentUser.uid)
  );

  unsubscribeChatList = onSnapshot(q, async (snapshot) => {
    if (snapshot.empty) {
      listEl.innerHTML = '';
      return;
    }

    let items = await Promise.all(snapshot.docs.map(async (chatDoc) => {
      const data = chatDoc.data();
      const otherUid = data.participants.find(uid => uid !== currentUser.uid);
      const other = await resolveUser(otherUid);
      const listingSnap = data.listingId
        ? await getDoc(doc(db, 'listings', data.listingId)).catch(() => null)
        : null;
      const listing = listingSnap?.exists?.() ? listingSnap.data() : null;
      const listingTitle = data.listingTitle || listing?.title || 'Tin đăng';
      const otherName = other?.name || data.sellerName || listing?.ownerName || 'Người dùng';
      const avatar = other?.photoURL;
      const lastUpdated = data.lastUpdated?.toDate?.() || new Date(0);
      const timeStr = formatTimeRelative(lastUpdated);
      const isActive = chatDoc.id === chatId;

      return { id: chatDoc.id, otherName, otherUid, avatar, listingTitle, lastMessage: data.lastMessage || '', lastUpdated, timeStr, isActive };
    }));

    // Sort by lastUpdated descending client-side
    items.sort((a, b) => b.lastUpdated - a.lastUpdated);

    listEl.innerHTML = items.map(item => `
      <a class="chat-list-item${item.isActive ? ' active' : ''}" href="chat.html?chat=${encodeURIComponent(item.id)}">
        <div class="chat-list-avatar">
          ${item.avatar ? `<img src="${escAttr(item.avatar)}" alt="">` : escHtml(item.otherName.charAt(0).toUpperCase())}
        </div>
        <div class="chat-list-body">
          <div class="chat-list-name">${escHtml(item.otherName)}</div>
          <div class="chat-list-preview">${escHtml(item.listingTitle)}${item.lastMessage ? ': ' + escHtml(item.lastMessage) : ''}</div>
        </div>
        <span class="chat-list-time">${item.timeStr}</span>
      </a>
    `).join('');
  }, (err) => {
    console.error('Chat list error:', err);
    listEl.innerHTML = `<div class="chat-list-loading" style="color:#b91c1c">Lỗi tải danh sách: ${err.message}</div>`;
  });
}

async function resolveUser(uid) {
  if (!uid) return null;
  if (curatedDataCache[uid]) return curatedDataCache[uid];
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      curatedDataCache[uid] = snap.data();
      return curatedDataCache[uid];
    }
  } catch {}
  return null;
}

// ── Chat creation ──
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

// ── Load single chat ──
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

  if (unsubscribeMessages) unsubscribeMessages();
  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    updateMessageList(snapshot);
  }, (err) => {
    console.error('Messages listener error:', err);
    renderChatError(errorMessage(err));
  });
}

function updateMessageList(snapshot) {
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
}

// ── Send message ──
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

// ── Render header ──
async function renderChatHeader(chatData) {
  const listingSnap = chatData.listingId
    ? await getDoc(doc(db, 'listings', chatData.listingId)).catch(() => null)
    : null;
  const listing = listingSnap?.exists?.() ? listingSnap.data() : null;
  const otherUid = chatData.participants?.find(uid => uid !== currentUser.uid);
  const other = await resolveUser(otherUid);
  const otherName = other?.name || chatData.sellerName || listing?.ownerName || 'Người dùng';
  const title = listing?.title || chatData.listingTitle || 'Tin đăng';
  const backUrl = chatData.listingId ? `product.html?id=${encodeURIComponent(chatData.listingId)}` : 'home.html';

  document.getElementById('chatHeader').innerHTML = `
    <a class="chat-back" href="chat.html" title="Danh sách tin nhắn">
      <i class="ti ti-arrow-left"></i>
    </a>
    <div>
      <h5>${escHtml(otherName)}</h5>
      <small>${escHtml(title)}</small>
    </div>
    <a class="ms-auto text-white" href="${backUrl}" title="Xem tin đăng" style="opacity:0.8">
      <i class="ti ti-external-link"></i>
    </a>
  `;
}

// ── Helpers ──
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

function formatTimeRelative(date) {
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ngày`;
  return date.toLocaleDateString('vi-VN');
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

function escAttr(str) {
  return escHtml(str).replace(/"/g, '&quot;');
}
