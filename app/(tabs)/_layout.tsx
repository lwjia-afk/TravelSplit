import { Tabs } from 'expo-router';
import { Text, Platform } from 'react-native';
import { useT } from '../../src/LanguageContext';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4F7FFF',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          paddingBottom: Platform.OS === 'android' ? 8 : 10,
          paddingTop: 6,
          height: Platform.OS === 'android' ? 60 : 70,
          backgroundColor: '#fff',
          borderTopColor: '#E8ECF4',
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="projects" options={{ title: t.tab_projects, tabBarIcon: ({ focused }) => <TabIcon emoji="📁" focused={focused} /> }} />
      <Tabs.Screen name="index"    options={{ title: t.tab_expenses, tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} /> }} />
      <Tabs.Screen name="members"  options={{ title: t.tab_members,  tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} /> }} />
      <Tabs.Screen name="summary"  options={{ title: t.tab_summary,  tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }} />
      <Tabs.Screen name="settle"   options={{ title: t.tab_settle,   tabBarIcon: ({ focused }) => <TabIcon emoji="💸" focused={focused} /> }} />
    </Tabs>
  );
}
