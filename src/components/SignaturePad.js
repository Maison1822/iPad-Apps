import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  PanResponder, Alert,
} from 'react-native';
import { COLORS, RADIUS } from '../lib/theme';

// Signature pad simple via SVG path sur Canvas View
// On utilise un canvas SVG-like avec PanResponder
export default function SignaturePad({ titre, onSave, onClose }) {
  const [paths, setPaths] = useState([]);
  const currentPath = useRef([]);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      currentPath.current = [{ x: locationX, y: locationY }];
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      currentPath.current = [...currentPath.current, { x: locationX, y: locationY }];
      setPaths(prev => {
        const next = [...prev];
        if (next.length > 0 && next[next.length - 1] === currentPath.current) {
          return prev;
        }
        return [...prev.filter((_, i) => i < prev.length - 1), [...currentPath.current]];
      });
    },
    onPanResponderRelease: () => {
      if (currentPath.current.length > 0) {
        setPaths(prev => {
          const last = prev[prev.length - 1];
          if (last && JSON.stringify(last) === JSON.stringify(currentPath.current)) return prev;
          return [...prev, [...currentPath.current]];
        });
        currentPath.current = [];
      }
    },
  });

  function pathToSVG(pts) {
    if (!pts || pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    return pts.reduce((acc, pt, i) =>
      i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`, '');
  }

  function svgToDataUrl() {
    const svgContent = paths.map(p => `<path d="${pathToSVG(p)}" stroke="#0F1E3C" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize.width}" height="${svgSize.height}" style="background:white">${svgContent}</svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }

  function handleSave() {
    if (paths.length === 0) {
      Alert.alert('Signature vide', 'Veuillez signer avant de valider');
      return;
    }
    onSave(svgToDataUrl());
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.annuler}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.titre}>{titre}</Text>
        <TouchableOpacity onPress={() => setPaths([])}>
          <Text style={styles.effacer}>Effacer</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.instruction}>Signez dans la zone ci-dessous</Text>

      <View
        style={styles.canvas}
        onLayout={e => setSvgSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        {...panResponder.panHandlers}
      >
        {/* Rendu des tracés via des vues absolues */}
        {paths.length === 0 && (
          <Text style={styles.canvasPlaceholder}>✍️</Text>
        )}
        {/* Note: en React Native sans SVG lib, on simule avec View absolues pour chaque segment */}
        {paths.map((path, pi) =>
          path.map((pt, i) => {
            if (i === 0) return null;
            const prev = path[i - 1];
            const dx = pt.x - prev.x;
            const dy = pt.y - prev.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            return (
              <View
                key={`${pi}-${i}`}
                style={{
                  position: 'absolute',
                  left: prev.x,
                  top: prev.y - 1.5,
                  width: length,
                  height: 3,
                  backgroundColor: COLORS.navy,
                  borderRadius: 1.5,
                  transform: [{ rotate: `${angle}deg` }, { translateX: 0 }],
                  transformOrigin: '0 50%',
                }}
              />
            );
          })
        )}
      </View>

      <TouchableOpacity style={styles.btnValider} onPress={handleSave}>
        <Text style={styles.btnValiderTxt}>Valider la signature</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: COLORS.navy },
  titre: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  annuler: { color: COLORS.gold, fontSize: 15 },
  effacer: { color: '#E57373', fontSize: 15 },
  instruction: { textAlign: 'center', color: COLORS.textMuted, fontSize: 13, marginTop: 20, marginBottom: 10 },
  canvas: {
    flex: 1,
    margin: 20,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasPlaceholder: { fontSize: 48, opacity: 0.2 },
  btnValider: { backgroundColor: COLORS.navy, margin: 20, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  btnValiderTxt: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
});
