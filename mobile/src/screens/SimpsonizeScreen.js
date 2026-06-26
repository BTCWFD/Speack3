import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Animated } from 'react-native';

const SimpsonizeScreen = () => {
  const [uploaded, setUploaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const scaleAnim = new Animated.Value(1);

  const handleUpload = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true })
    ]).start();

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setUploaded(true);
    }, 2000);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Simpsonize Yourself</Text>
        <Text style={styles.subtitle}>AI-Powered Avatar Generator</Text>
      </View>

      {!uploaded ? (
        <View style={styles.glassCard}>
          <Text style={styles.cardTitle}>Upload Your Photo</Text>
          <Text style={styles.cardDesc}>Get two premium Simpson-style avatars generated instantly.</Text>
          
          <View style={styles.uploadArea}>
            <Text style={styles.uploadIcon}>📸</Text>
            <Text style={styles.uploadText}>Tap to select image</Text>
          </View>

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleUpload}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Generating...' : 'Generate Avatars'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : (
        <View style={styles.glassCard}>
          <Text style={styles.cardTitle}>Your Avatars are Ready! 🎉</Text>
          
          <View style={styles.resultsContainer}>
            <View style={styles.imageWrapper}>
              {/* Using generic placeholders assuming the assets exist */}
              <Image source={require('../../assets/simpsons/avatar1.png')} style={styles.resultImage} defaultSource={{uri: 'https://via.placeholder.com/150/FFD90F/000000?text=Avatar+1'}} />
            </View>
            <View style={styles.imageWrapper}>
              <Image source={require('../../assets/simpsons/avatar2.png')} style={styles.resultImage} defaultSource={{uri: 'https://via.placeholder.com/150/FFD90F/000000?text=Avatar+2'}} />
            </View>
          </View>

          <TouchableOpacity style={styles.buttonSecondary} onPress={() => setUploaded(false)}>
            <Text style={styles.buttonTextSecondary}>Try Another Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Get Premium Avatars</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Dark mode premium background
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
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
    textAlign: 'center',
    fontWeight: '500',
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 15,
    color: '#CBD5E1',
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 22,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: 'rgba(255, 217, 15, 0.5)', // Simpson yellow accent
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: 'rgba(255, 217, 15, 0.05)',
  },
  uploadIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  uploadText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#FFD90F', // Simpson Yellow
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FFD90F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 20,
  },
  buttonTextSecondary: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  imageWrapper: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  resultImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});

export default SimpsonizeScreen;
