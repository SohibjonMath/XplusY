const notice = document.getElementById('notice');
function setNotice(text, bad = false) { notice.textContent = text || ''; notice.style.color = bad ? '#b42318' : '#067647'; }
document.getElementById('importBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/https?:\/\/[^/]*1688\.com\//i.test(tab.url || '')) throw new Error('Avval 1688 mahsulot sahifasini oching.');
    setNotice('Mahsulot ma’lumoti yig‘ilmoqda...');
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_AND_IMPORT' });
    if (!response?.ok) throw new Error(response?.error || 'Import boshlanmadi. Sahifani yangilang.');
    setNotice('Admin oynasi ochildi.');
  } catch (error) { setNotice(error.message || 'Import xatosi', true); }
});
document.getElementById('settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
