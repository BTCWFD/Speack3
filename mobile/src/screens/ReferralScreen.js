import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Clipboard, Alert } from 'react-native';

const ReferralScreen = () => {
  const [referralCode] = useState('SPEACK-XYZ99');
  const [unlockedStyles, setUnlockedStyles] = useState(['simpsonize']);
  const [loading, setLoading] = useState(false);

  const copyToClipboard = () => {
    // In a real app we'd use Clipboard API or expo-clipboard
    // Clipboard.setString(referralCode);
    Alert.alert('¡Copiado!', 'Código de invitación copiado al portapapeles.');
  };

  const handleShare = () => {
    // Simulated share action
    Alert.alert('Compartir', 'Abriendo opciones de compartir nativas...');
  };

  const stylesList = [
    { id: 'simpsonize', name: 'Simpson 2D', icon: '🍩', unlocked: unlockedStyles.includes('simpsonize'), color: '#FFD90F' },
    { id: 'cyberpunk', name: 'Cyberpunk', icon: '🤖', unlocked: unlockedStyles.includes('cyberpunk'), color: '#E81469' },
    { id: 'pixar3d', name: 'Pixar 3D', icon: '🎈', unlocked: unlockedStyles.includes('pixar3d'), color: '#3B82F6' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Invita y Desbloquea</Text>
        <Text style={styles.subtitle}>Simpsoniza a un amigo y gana estilos premium</Text>
      </View>

      <View style={styles.glassCard}>
        <Text style={styles.cardTitle}>Tu Código de Referido</Text>
        <Text style={styles.cardDesc}>
          Comparte este código con tus amigos. Cuando ellos generen su primer avatar, ¡tú desbloquearás un nuevo estilo automáticamente!
        </Text>
        
        <View style={styles.codeContainer}>
          <Text style={styles.codeText}>{referralCode}</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.button, styles.buttonHalf]} onPress={copyToClipboard}>
            <Text style={styles.buttonText}>Copiar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.buttonSecondary, styles.buttonHalf]} onPress={handleShare}>
            <Text style={styles.buttonTextSecondary}>Compartir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Tus Estilos IA</Text>

      {stylesList.map((style) => (
        <View key={style.id} style={[styles.styleCard, !style.unlocked && styles.styleCardLocked]}>
          <View style={[styles.iconContainer, { backgroundColor: style.color + '20' }]}>
            <Text style={styles.icon}>{style.icon}</Text>
          </View>
          <View style={styles.styleInfo}>
            <Text style={styles.styleName}>{style.name}</Text>
            <Text style={styles.styleDesc}>
              {style.unlocked ? 'Desbloqueado y listo para usar.' : 'Invita a 1 amigo para desbloquear.'}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusIcon}>{style.unlocked ? '✅' : '🔒'}</Text>
          </View>
        </View>
      ))}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 15,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  codeContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 217, 15, 0.3)',
  },
  codeText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFD90F',
    letterSpacing: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: '#FFD90F',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonHalf: {
    width: '48%',
  },
  buttonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextSecondary: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  styleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  styleCardLocked: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  icon: {
    fontSize: 24,
  },
  styleInfo: {
    flex: 1,
  },
  styleName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  styleDesc: {
    color: '#94A3B8',
    fontSize: 13,
  },
  statusBadge: {
    marginLeft: 16,
  },
  statusIcon: {
    fontSize: 20,
  },
});

export default ReferralScreen;
