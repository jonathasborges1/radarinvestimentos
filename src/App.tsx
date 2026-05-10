import { useCallback, useState } from 'react';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { AssetProvider } from './context/AssetContext';
import { useAssets } from './hooks/useAssets';
import { useTheme } from './hooks/useTheme';
import { useMediaQuery } from './hooks/useMediaQuery';
import { Header } from './components/Header';
import { MainContent } from './components/MainContent';
import { UploadHistoryModal } from './components/UploadHistoryModal';

/**
 * Inner app component that has access to both AssetContext and NotificationContext.
 * Handles the wiring between Header actions and the asset/notification hooks.
 */
function AppContent() {
  const { state, mergeFromFile, exportToJson, clearStorage, uploadHistory } = useAssets();
  const { addNotification } = useNotification();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [historyOpen, setHistoryOpen] = useState(false);

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const { added, updated, skipped } = await mergeFromFile(file);
        const summary = `${added} novo(s), ${updated} atualizado(s), ${skipped} duplicado(s) evitado(s).`;
        if (added === 0 && updated === 0) {
          addNotification('info', `Nenhuma alteração: ${summary}`);
        } else {
          addNotification('success', `Importação concluída: ${summary}`);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Erro ao importar arquivo.';
        addNotification('error', message);
      }
    },
    [mergeFromFile, addNotification]
  );

  const handleExport = useCallback(() => {
    exportToJson();
    addNotification('success', 'Arquivo exportado com sucesso.');
  }, [exportToJson, addNotification]);

  const handleClearStorage = useCallback(() => {
    const confirmed = window.confirm(
      'Tem certeza que deseja limpar todos os dados locais?'
    );
    if (confirmed) {
      clearStorage();
      addNotification('info', 'Dados locais removidos.');
    }
  }, [clearStorage, addNotification]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Header
        onImport={handleImport}
        onExport={handleExport}
        onClearStorage={handleClearStorage}
        onOpenHistory={() => setHistoryOpen(true)}
        hasUnsavedChanges={state.hasUnsavedChanges}
        hasData={state.status === 'loaded'}
        hasHistory={uploadHistory.length > 0}
        onToggleTheme={toggleTheme}
        isDark={theme === 'dark'}
      />
      <MainContent />
      <UploadHistoryModal
        history={uploadHistory}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        isMobile={isMobile}
      />
    </div>
  );
}

/**
 * Root App component.
 * Wraps the application in NotificationProvider and AssetProvider.
 */
function App() {
  return (
    <NotificationProvider>
      <AssetProvider>
        <AppContent />
      </AssetProvider>
    </NotificationProvider>
  );
}

export default App;
