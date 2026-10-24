import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, TouchableOpacity, StyleSheet, View, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scenes, START } from './src/story';

const SAVE_KEY = 'aventure-save';

export default function App() {
  const [scene, setScene] = useState(START);
  const [inventory, setInventory] = useState([]);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SAVE_KEY)
      .then((raw) => {
        if (!raw) return;
        const save = JSON.parse(raw);
        if (scenes[save.scene]) {
          setScene(save.scene);
          setInventory(save.inventory || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SAVE_KEY, JSON.stringify({ scene, inventory })).catch(() => {});
  }, [scene, inventory, loaded]);

  const current = scenes[scene];

  const go = (choice) => {
    if (choice.requires && !inventory.includes(choice.requires)) {
      setMessage(choice.hint || 'Tu ne peux pas faire ça pour le moment.');
      return;
    }
    const next = scenes[choice.to];
    setMessage('');
    if (next.item && !inventory.includes(next.item)) {
      setInventory((inv) => [...inv, next.item]);
      setMessage(`Tu ramasses : ${next.item}`);
    }
    setScene(choice.to);
  };

  const restart = () => {
    setScene(START);
    setInventory([]);
    setMessage('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>🌲 La Forêt Oubliée</Text>
      <Text style={styles.inventory}>🎒 {inventory.length ? inventory.join(', ') : 'vide'}</Text>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.story}>{current.text}</Text>
        {!!message && <Text style={styles.message}>{message}</Text>}

        {current.fin ? (
          <View>
            <Text style={[styles.end, current.fin === 'victoire' ? styles.win : styles.lose]}>
              {current.fin === 'victoire' ? '🏆 Victoire !' : '💀 Game over'}
            </Text>
            <TouchableOpacity style={styles.button} onPress={restart}>
              <Text style={styles.buttonText}>Rejouer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          current.choices.map((c) => (
            <TouchableOpacity key={c.label} style={styles.button} onPress={() => go(c)}>
              <Text style={styles.buttonText}>{c.label}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {!current.fin && (
        <TouchableOpacity
          onPress={() => Alert.alert('Recommencer ?', 'Ta progression sera perdue.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Oui', onPress: restart },
          ])}
        >
          <Text style={styles.reset}>Recommencer</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#14181f', padding: 20, paddingTop: 50 },
  title: { color: '#e8d9a8', fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  inventory: { color: '#9aa5b1', textAlign: 'center', marginVertical: 10 },
  content: { paddingVertical: 10 },
  story: { color: '#f1f1f1', fontSize: 18, lineHeight: 28, marginBottom: 20 },
  message: { color: '#f0b429', fontStyle: 'italic', marginBottom: 16 },
  button: { backgroundColor: '#2d3a4f', padding: 16, borderRadius: 12, marginBottom: 12 },
  buttonText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  end: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  win: { color: '#4ade80' },
  lose: { color: '#f87171' },
  reset: { color: '#6b7685', textAlign: 'center', padding: 10 },
});
