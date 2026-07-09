import React from 'react';
import { AppProvider, useApp } from './store/AppContext';
import Navbar from './components/layout/Navbar';
import { LoginModal, PricingModal } from './components/business/Modals';
import HomePage from './pages/Home/index';
import GalleryPage from './pages/Gallery/index';
import PricingPage from './pages/Pricing/index';
import WorksPage from './pages/Works/index';
import LoadingView from './pages/Generate/Loading';
import NoteModal from './NoteModal';
import { downloadZip, saveWork, regenerateText } from './services/api';

function AppRouter() {
  const { state, dispatch } = useApp();
  const { page, genState, result } = state;

  const textRegen = async () => {
    if (!result || result._galleryItem) { alert('这是薯包出品的展示内容，请先自己生成作品后再使用此功能'); return; }
    try {
      const d = await regenerateText(result._inputText || result.title, result.category);
      dispatch({
        type: 'UPDATE_RESULT',
        updater: (prev) => ({ ...prev, title: d.title || prev.title, body_text: d.body_text || prev.body_text, hashtags: d.hashtags || prev.hashtags, pages: d.pages || prev.pages }),
      });
    } catch (e) { alert('文案重生成失败：' + e.message); }
  };

  const handleDownload = () => {
    if (result?._galleryItem) { alert('这是薯包出品的展示内容，请先自己生成作品后再使用此功能'); return; }
    downloadZip(result.cover_url, result.image_urls, result.title, result.body_text, result.hashtags);
  };

  if (genState === 'loading') {
    return (<><Navbar /><LoadingView /><LoginModal /><PricingModal /></>);
  }

  if (genState === 'result' && result) {
    return (
      <>
        <NoteModal
          item={result}
          onClose={() => { dispatch({ type: 'CLOSE_RESULT' }); if (state.scrollPos) setTimeout(() => window.scrollTo(0, state.scrollPos), 50); }}
          textRegen={textRegen}
          onDownload={handleDownload}
          onUnlock={() => dispatch({ type: 'SHOW_PRICE', show: true })}
          onItemUpdate={(i, url) => {
            dispatch({ type: 'UPDATE_RESULT', updater: (prev) => {
              if (!prev) return prev;
              if (i === 0) return { ...prev, cover_url: url };
              const u = [...(prev.image_urls || [])]; if (u[i-1]) u[i-1] = url;
              return { ...prev, image_urls: u };
            }});
            if (result._inputText) {
              const updated = { ...result };
              if (i === 0) updated.cover_url = url;
              else { const u = [...(updated.image_urls || [])]; if (u[i-1]) u[i-1] = url; updated.image_urls = u; }
              saveWork(updated);
            }
          }}
        />
        <LoginModal /><PricingModal />
      </>
    );
  }

  const PageComponent = { home: HomePage, gallery: GalleryPage, pricing: PricingPage, works: WorksPage }[page] || HomePage;
  return (<><Navbar /><PageComponent /><LoginModal /><PricingModal /></>);
}

export default function App() {
  return (<AppProvider><AppRouter /></AppProvider>);
}
