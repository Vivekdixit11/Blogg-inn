/**
 * Blogi Write Page - JavaScript
 * Handles authentication, markdown editing, preview, and publishing
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Password hash (In production, this would be validated server-side)
  // Default password: "blogi2026" - Change this in production!
  PASSWORD_HASH: 'blogi2026',
  
  // Max login attempts before lockout
  MAX_ATTEMPTS: 5,
  
  // Lockout duration in minutes
  LOCKOUT_DURATION: 15,
  
  // Auto-save interval in ms
  AUTOSAVE_INTERVAL: 30000,
  
  // Style mappings
  STYLES: {
    bg: {
      white: '#ffffff',
      gray: '#f9fafb',
      cream: '#fefce8',
      dark: '#0f172a'
    },
    accent: {
      blue: '#2563eb',
      purple: '#7c3aed',
      green: '#16a34a',
      amber: '#d97706',
      rose: '#e11d48'
    },
    font: {
      system: 'system-ui, -apple-system, sans-serif',
      serif: 'Georgia, Cambria, serif',
      mono: 'ui-monospace, monospace'
    }
  }
};

// ============================================
// STATE
// ============================================

let state = {
  isAuthenticated: false,
  loginAttempts: 0,
  lockoutUntil: null,
  article: {
    title: '',
    slug: '',
    content: '',
    category: '',
    author: 'Editorial Team',
    tags: [],
    publishDate: new Date().toISOString().split('T')[0],
    excerpt: '',
    featuredScore: 50,
    thumbnail: '',
    youtubeUrl: '',
    bgColor: 'white',
    accentColor: 'blue',
    fontStyle: 'system'
  },
  isDirty: false,
  lastSaved: null
};

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
  // Password lock
  passwordLock: document.getElementById('passwordLock'),
  writeEditor: document.getElementById('writeEditor'),
  passwordInput: document.getElementById('passwordInput'),
  unlockBtn: document.getElementById('unlockBtn'),
  passwordError: document.getElementById('passwordError'),
  attemptsCount: document.getElementById('attemptsCount'),
  
  // Editor
  articleTitle: document.getElementById('articleTitle'),
  articleSlug: document.getElementById('articleSlug'),
  articleContent: document.getElementById('articleContent'),
  articleCategory: document.getElementById('articleCategory'),
  articleAuthor: document.getElementById('articleAuthor'),
  articleTags: document.getElementById('articleTags'),
  articleDate: document.getElementById('articleDate'),
  articleExcerpt: document.getElementById('articleExcerpt'),
  featuredScore: document.getElementById('featuredScore'),
  featuredScoreValue: document.getElementById('featuredScoreValue'),
  thumbnailUrl: document.getElementById('thumbnailUrl'),
  thumbnailPreview: document.getElementById('thumbnailPreview'),
  youtubeUrl: document.getElementById('youtubeUrl'),
  fontStyle: document.getElementById('fontStyle'),
  
  // Preview
  previewToggle: document.getElementById('previewToggle'),
  editorContainer: document.getElementById('editorContainer'),
  previewContainer: document.getElementById('previewContainer'),
  
  // Actions
  saveDraftBtn: document.getElementById('saveDraftBtn'),
  publishBtn: document.getElementById('publishBtn'),
  saveStatus: document.getElementById('saveStatus'),
  
  // Color palettes
  bgColorPalette: document.getElementById('bgColorPalette'),
  accentColorPalette: document.getElementById('accentColorPalette')
};

// ============================================
// AUTHENTICATION
// ============================================

function checkLockout() {
  const lockoutData = localStorage.getItem('blogi_lockout');
  if (lockoutData) {
    const lockoutUntil = new Date(lockoutData);
    if (lockoutUntil > new Date()) {
      const minutesLeft = Math.ceil((lockoutUntil - new Date()) / 60000);
      elements.passwordError.textContent = `Too many attempts. Try again in ${minutesLeft} minutes.`;
      elements.passwordError.style.display = 'block';
      elements.unlockBtn.disabled = true;
      elements.passwordInput.disabled = true;
      return true;
    } else {
      localStorage.removeItem('blogi_lockout');
    }
  }
  return false;
}

function handleLogin() {
  if (checkLockout()) return;
  
  const password = elements.passwordInput.value;
  
  // Simple password check (In production, use server-side validation)
  if (password === CONFIG.PASSWORD_HASH) {
    state.isAuthenticated = true;
    state.loginAttempts = 0;
    localStorage.removeItem('blogi_attempts');
    
    // Store session token
    const token = generateSessionToken();
    sessionStorage.setItem('blogi_session', token);
    
    // Show editor
    elements.passwordLock.style.display = 'none';
    elements.writeEditor.classList.add('active');
    
    // Load any saved draft
    loadDraft();
  } else {
    state.loginAttempts++;
    localStorage.setItem('blogi_attempts', state.loginAttempts);
    
    const remaining = CONFIG.MAX_ATTEMPTS - state.loginAttempts;
    elements.attemptsCount.textContent = remaining;
    
    if (remaining <= 0) {
      // Lockout
      const lockoutUntil = new Date(Date.now() + CONFIG.LOCKOUT_DURATION * 60000);
      localStorage.setItem('blogi_lockout', lockoutUntil.toISOString());
      checkLockout();
    } else {
      elements.passwordError.textContent = 'Invalid password. Please try again.';
      elements.passwordError.style.display = 'block';
      elements.passwordInput.value = '';
      elements.passwordInput.focus();
    }
  }
}

function generateSessionToken() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function checkSession() {
  const session = sessionStorage.getItem('blogi_session');
  if (session) {
    state.isAuthenticated = true;
    elements.passwordLock.style.display = 'none';
    elements.writeEditor.classList.add('active');
    loadDraft();
  }
}

// ============================================
// SLUG GENERATION
// ============================================

function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================
// MARKDOWN PARSER
// ============================================

function parseMarkdown(markdown) {
  let html = markdown;
  
  // Escape HTML
  html = html.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');
  
  // Code blocks (must be first)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Headings
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');
  
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  // YouTube embeds
  html = html.replace(/\{\{youtube:([^}]+)\}\}/g, (match, videoId) => {
    // Extract video ID from URL if needed
    const id = extractYouTubeId(videoId);
    return `<div class="video-container">
      <iframe src="https://www.youtube.com/embed/${id}" 
              title="YouTube video" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen></iframe>
    </div>`;
  });
  
  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Paragraphs
  html = html.split('\n\n').map(block => {
    if (block.trim() && 
        !block.startsWith('<h') && 
        !block.startsWith('<ul') && 
        !block.startsWith('<ol') && 
        !block.startsWith('<pre') && 
        !block.startsWith('<blockquote') &&
        !block.startsWith('<div') &&
        !block.startsWith('<hr')) {
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }
    return block;
  }).join('\n');
  
  return html;
}

function extractYouTubeId(url) {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return url;
}

// ============================================
// PREVIEW
// ============================================

function updatePreview() {
  const content = elements.articleContent.value;
  const html = parseMarkdown(content);
  elements.previewContainer.innerHTML = html;
}

function togglePreview(mode) {
  const buttons = elements.previewToggle.querySelectorAll('button');
  buttons.forEach(btn => btn.classList.remove('active'));
  
  const activeBtn = elements.previewToggle.querySelector(`[data-mode="${mode}"]`);
  activeBtn.classList.add('active');
  
  if (mode === 'preview') {
    updatePreview();
    elements.editorContainer.style.display = 'none';
    elements.previewContainer.classList.add('active');
  } else {
    elements.editorContainer.style.display = 'block';
    elements.previewContainer.classList.remove('active');
  }
}

// ============================================
// COLOR PALETTE
// ============================================

function setupColorPalette(palette, stateKey) {
  const options = palette.querySelectorAll('.color-option');
  
  options.forEach(option => {
    option.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      state.article[stateKey] = option.dataset.color;
      markDirty();
    });
  });
}

// ============================================
// DRAFT MANAGEMENT
// ============================================

function saveDraft() {
  const article = collectArticleData();
  localStorage.setItem('blogi_draft', JSON.stringify(article));
  state.lastSaved = new Date();
  state.isDirty = false;
  updateSaveStatus();
}

function loadDraft() {
  const draft = localStorage.getItem('blogi_draft');
  if (draft) {
    const article = JSON.parse(draft);
    populateForm(article);
  }
  
  // Set today's date if not set
  if (!elements.articleDate.value) {
    elements.articleDate.value = new Date().toISOString().split('T')[0];
  }
}

function populateForm(article) {
  elements.articleTitle.value = article.title || '';
  elements.articleSlug.value = article.slug || '';
  elements.articleContent.value = article.content || '';
  elements.articleCategory.value = article.category || '';
  elements.articleAuthor.value = article.author || 'Editorial Team';
  elements.articleTags.value = (article.tags || []).join(', ');
  elements.articleDate.value = article.publishDate || new Date().toISOString().split('T')[0];
  elements.articleExcerpt.value = article.excerpt || '';
  elements.featuredScore.value = article.featuredScore || 50;
  elements.featuredScoreValue.textContent = article.featuredScore || 50;
  elements.thumbnailUrl.value = article.thumbnail || '';
  elements.youtubeUrl.value = article.youtubeUrl || '';
  elements.fontStyle.value = article.fontStyle || 'system';
  
  // Update color palettes
  updateColorSelection('bgColorPalette', article.bgColor || 'white');
  updateColorSelection('accentColorPalette', article.accentColor || 'blue');
  
  // Update thumbnail preview
  updateThumbnailPreview();
}

function updateColorSelection(paletteId, color) {
  const palette = document.getElementById(paletteId);
  const options = palette.querySelectorAll('.color-option');
  options.forEach(o => o.classList.remove('selected'));
  const selected = palette.querySelector(`[data-color="${color}"]`);
  if (selected) selected.classList.add('selected');
}

function collectArticleData() {
  return {
    title: elements.articleTitle.value,
    slug: elements.articleSlug.value,
    content: elements.articleContent.value,
    category: elements.articleCategory.value,
    author: elements.articleAuthor.value,
    tags: elements.articleTags.value.split(',').map(t => t.trim()).filter(Boolean),
    publishDate: elements.articleDate.value,
    excerpt: elements.articleExcerpt.value,
    featuredScore: parseInt(elements.featuredScore.value),
    thumbnail: elements.thumbnailUrl.value,
    youtubeUrl: elements.youtubeUrl.value,
    bgColor: state.article.bgColor,
    accentColor: state.article.accentColor,
    fontStyle: elements.fontStyle.value
  };
}

function markDirty() {
  state.isDirty = true;
  updateSaveStatus();
}

function updateSaveStatus() {
  if (state.isDirty) {
    elements.saveStatus.textContent = 'Unsaved changes';
    elements.saveStatus.style.color = 'var(--color-warning)';
  } else if (state.lastSaved) {
    const timeAgo = getTimeAgo(state.lastSaved);
    elements.saveStatus.textContent = `Saved ${timeAgo}`;
    elements.saveStatus.style.color = 'var(--color-success)';
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ============================================
// THUMBNAIL PREVIEW
// ============================================

function updateThumbnailPreview() {
  const url = elements.thumbnailUrl.value;
  if (url) {
    elements.thumbnailPreview.style.display = 'block';
    elements.thumbnailPreview.querySelector('img').src = url;
  } else {
    elements.thumbnailPreview.style.display = 'none';
  }
}

// ============================================
// PUBLISH
// ============================================

function generateFrontmatter(article) {
  return `---
title: "${article.title}"
slug: "${article.slug}"
author: "${article.author}"
category: "${article.category}"
tags: [${article.tags.map(t => `"${t}"`).join(', ')}]
publish_date: "${article.publishDate}"
featured_score: ${article.featuredScore}
background_color: "${article.bgColor}"
page_accent: "${article.accentColor}"
font_style: "${article.fontStyle}"
thumbnail: "${article.thumbnail}"
excerpt: "${article.excerpt}"
youtube_url: "${article.youtubeUrl}"
---

${article.content}`;
}

function publish() {
  const article = collectArticleData();
  
  // Validation
  if (!article.title) {
    alert('Please enter an article title.');
    elements.articleTitle.focus();
    return;
  }
  
  if (!article.slug) {
    article.slug = generateSlug(article.title);
    elements.articleSlug.value = article.slug;
  }
  
  if (!article.category) {
    alert('Please select a category.');
    elements.articleCategory.focus();
    return;
  }
  
  if (!article.content) {
    alert('Please write some content.');
    elements.articleContent.focus();
    return;
  }
  
  // Generate frontmatter
  const markdown = generateFrontmatter(article);
  
  // In a real implementation, this would send to a serverless API
  // For now, we'll download the file
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${article.slug}.md`;
  a.click();
  URL.revokeObjectURL(url);
  
  // Clear draft
  localStorage.removeItem('blogi_draft');
  
  alert('Article downloaded! In production, this would be saved to the server and trigger a rebuild.');
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Password login
  elements.unlockBtn.addEventListener('click', handleLogin);
  elements.passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  
  // Auto-generate slug from title
  elements.articleTitle.addEventListener('input', () => {
    if (!elements.articleSlug.value || elements.articleSlug.dataset.autoGenerated === 'true') {
      elements.articleSlug.value = generateSlug(elements.articleTitle.value);
      elements.articleSlug.dataset.autoGenerated = 'true';
    }
    markDirty();
  });
  
  elements.articleSlug.addEventListener('input', () => {
    elements.articleSlug.dataset.autoGenerated = 'false';
    markDirty();
  });
  
  // Mark dirty on input
  const inputs = [
    elements.articleContent,
    elements.articleCategory,
    elements.articleAuthor,
    elements.articleTags,
    elements.articleDate,
    elements.articleExcerpt,
    elements.thumbnailUrl,
    elements.youtubeUrl,
    elements.fontStyle
  ];
  
  inputs.forEach(input => {
    if (input) input.addEventListener('input', markDirty);
  });
  
  // Featured score slider
  elements.featuredScore.addEventListener('input', () => {
    elements.featuredScoreValue.textContent = elements.featuredScore.value;
    markDirty();
  });
  
  // Thumbnail preview
  elements.thumbnailUrl.addEventListener('input', updateThumbnailPreview);
  
  // Preview toggle
  elements.previewToggle.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      togglePreview(e.target.dataset.mode);
    }
  });
  
  // Color palettes
  setupColorPalette(elements.bgColorPalette, 'bgColor');
  setupColorPalette(elements.accentColorPalette, 'accentColor');
  
  // Save draft
  elements.saveDraftBtn.addEventListener('click', () => {
    saveDraft();
    alert('Draft saved!');
  });
  
  // Publish
  elements.publishBtn.addEventListener('click', publish);
  
  // Auto-save
  setInterval(() => {
    if (state.isDirty && state.isAuthenticated) {
      saveDraft();
    }
  }, CONFIG.AUTOSAVE_INTERVAL);
  
  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (state.isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================

function init() {
  // Check for existing session
  checkSession();
  
  // Check lockout status
  if (!state.isAuthenticated) {
    checkLockout();
    
    // Restore attempt count
    const attempts = localStorage.getItem('blogi_attempts');
    if (attempts) {
      state.loginAttempts = parseInt(attempts);
      elements.attemptsCount.textContent = CONFIG.MAX_ATTEMPTS - state.loginAttempts;
    }
  }
  
  // Setup event listeners
  setupEventListeners();
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', init);
