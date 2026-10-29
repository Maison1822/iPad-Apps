import React, { createContext, useContext, useState } from 'react';
import { T } from './i18n';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [lang, setLang] = useState('FR');
  const [devisCourant, setDevisCourant] = useState({
    client: null,
    lignes: [],
    date: new Date().toISOString().slice(0, 10),
    numero: `DEV-${Date.now()}`,
    signatureClient: null,
    signatureCommercial: null,
    etatDest: 'SP',
    icmsPct: 18,
  });

  const t = T[lang];

  function addLigneDevis(produit, quantite = 1) {
    setDevisCourant(prev => {
      const existing = prev.lignes.find(l => l.produit.id === produit.id);
      if (existing) {
        return {
          ...prev,
          lignes: prev.lignes.map(l =>
            l.produit.id === produit.id
              ? { ...l, quantite: l.quantite + quantite }
              : l
          ),
        };
      }
      return {
        ...prev,
        lignes: [...prev.lignes, { produit, quantite, prixUnitaire: produit.pvc_ttc_brl || 0 }],
      };
    });
  }

  function removeLigneDevis(produitId) {
    setDevisCourant(prev => ({
      ...prev,
      lignes: prev.lignes.filter(l => l.produit.id !== produitId),
    }));
  }

  function updateQuantite(produitId, quantite) {
    setDevisCourant(prev => ({
      ...prev,
      lignes: prev.lignes.map(l =>
        l.produit.id === produitId ? { ...l, quantite } : l
      ),
    }));
  }

  function resetDevis() {
    setDevisCourant({
      client: null,
      lignes: [],
      date: new Date().toISOString().slice(0, 10),
      numero: `DEV-${Date.now()}`,
      signatureClient: null,
      signatureCommercial: null,
      etatDest: 'SP',
      icmsPct: 18,
    });
  }

  return (
    <AppContext.Provider value={{
      lang, setLang, t,
      devisCourant, setDevisCourant,
      addLigneDevis, removeLigneDevis, updateQuantite, resetDevis,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
