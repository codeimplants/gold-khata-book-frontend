import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Image } from 'react-native';

const BrandLoader = () => {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logoBox}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logoImage}
          />
        </View>
        <Text style={styles.appName}>Gold Khata Book</Text>
      </View>
      <ActivityIndicator size="large" color="#A855F7" style={styles.indicator} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB', // Light gray background
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  appName: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  indicator: {
    marginTop: 20,
  },
});

export default BrandLoader;
