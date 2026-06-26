import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

const CheckoutScreen = () => {
  const [selectedMethod, setSelectedMethod] = useState(null);

  const methods = [
    { id: 'nequi', name: 'Nequi', icon: '📱', color: '#E81469', desc: 'Instant transfer via Nequi' },
    { id: 'usdt', name: 'Crypto USDT', icon: '💎', color: '#26A17B', desc: 'Pay via Web3 Wallet (Polygon/BSC)' },
  ];

  const handlePayment = async () => {
    try {
      const endpoint = selectedMethod === 'nequi' 
        ? 'http://10.0.2.2:3000/api/payments/nequi' 
        : 'http://10.0.2.2:3000/api/payments/usdt';

      const payload = selectedMethod === 'nequi' 
        ? { phoneNumber: '3001234567', amount: 20000 }
        : { userId: 'user_123', amountUSDT: 5 };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();

      if(result.success) {
         alert(`Intención de pago creada: ${result.paymentIntent.status}`);
      } else {
         alert('Error al crear pago');
      }
    } catch(error) {
      console.error("Error en la pasarela de pago:", error);
      alert('Network error');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete Order</Text>
        <Text style={styles.subtitle}>Unlock High-Res Avatars</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Premium AI Avatars</Text>
          <Text style={styles.summaryPrice}>$5.00</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalText}>Total</Text>
          <Text style={styles.totalPrice}>$5.00</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Select Payment Method</Text>

      {methods.map((method) => (
        <TouchableOpacity
          key={method.id}
          style={[
            styles.methodCard,
            selectedMethod === method.id && { borderColor: method.color, backgroundColor: 'rgba(255,255,255,0.1)' }
          ]}
          onPress={() => setSelectedMethod(method.id)}
        >
          <View style={[styles.iconContainer, { backgroundColor: method.color + '20' }]}>
            <Text style={styles.icon}>{method.icon}</Text>
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodName}>{method.name}</Text>
            <Text style={styles.methodDesc}>{method.desc}</Text>
          </View>
          <View style={[styles.radio, selectedMethod === method.id && { borderColor: method.color }]}>
            {selectedMethod === method.id && <View style={[styles.radioInner, { backgroundColor: method.color }]} />}
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity 
        style={[styles.payButton, !selectedMethod && styles.payButtonDisabled]}
        disabled={!selectedMethod}
        onPress={handlePayment}
      >
        <Text style={styles.payButtonText}>
          {selectedMethod === 'usdt' ? 'Connect Wallet & Pay' : 'Pay Now'}
        </Text>
      </TouchableOpacity>
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
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 32,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    color: '#CBD5E1',
    fontSize: 16,
  },
  summaryPrice: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  totalText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalPrice: {
    color: '#FFD90F', // Accent color
    fontSize: 24,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
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
  methodInfo: {
    flex: 1,
  },
  methodName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  methodDesc: {
    color: '#94A3B8',
    fontSize: 13,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#64748B',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  payButton: {
    backgroundColor: '#3B82F6', // Premium Blue
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  payButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowOpacity: 0,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CheckoutScreen;
