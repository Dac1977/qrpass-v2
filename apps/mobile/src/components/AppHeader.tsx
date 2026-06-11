import React from 'react';
import { View, StyleSheet, Image, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  onBackPress?: () => void;
}

export function AppHeader({ title, showBack, onBackPress }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <Image 
          source={require('../../assets/qrpasssintextotransparente.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        {showBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      
      {title && (
        <View style={styles.centerSection}>
          <Text style={styles.title}>{title}</Text>
        </View>
      )}
      
      <View style={styles.rightSection} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 40,
    height: 40,
  },
  backButton: {
    marginLeft: 12,
    padding: 4,
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  rightSection: {
    flex: 1,
  },
});
