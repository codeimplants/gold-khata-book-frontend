// App-wide toast notifications, replacing scattered Alert.alert calls with a
// non-blocking, auto-dismissing banner (mirrors sonetaran-mobile's toast).
//
// Architecture: a module-level store (no context needed — callable from any
// code, including services/thunks outside the component tree) plus a
// <ToastViewport /> that renders the queue. Mount one at the app root; if a
// screen presents a native RN <Modal> (its own top-level native layer) and
// needs toasts to remain visible above it, mount an extra <ToastViewport />
// inside that modal too — viewports register in a stack and only the
// topmost one renders.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react-native';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
  leaving?: boolean;
};

const DURATION_MS = 3200;
const LEAVE_MS = 220;

// ---- store ----------------------------------------------------------------

let nextId = 1;
let queue: ToastItem[] = [];
const queueListeners = new Set<() => void>();

let nextViewportId = 1;
let viewportStack: number[] = [];
const viewportListeners = new Set<() => void>();

const notifyQueue = () => queueListeners.forEach(l => l());
const notifyViewports = () => viewportListeners.forEach(l => l());

function show(type: ToastType, message: string, title?: string) {
  const id = nextId++;
  queue = [...queue, { id, type, message, title }];
  notifyQueue();
  setTimeout(() => {
    queue = queue.map(t => (t.id === id ? { ...t, leaving: true } : t));
    notifyQueue();
    setTimeout(() => {
      queue = queue.filter(t => t.id !== id);
      notifyQueue();
    }, LEAVE_MS);
  }, DURATION_MS);
}

export const toast = {
  success: (message: string, title?: string) => show('success', message, title),
  error: (message: string, title?: string) => show('error', message, title),
  warning: (message: string, title?: string) => show('warning', message, title),
  info: (message: string, title?: string) => show('info', message, title),
  dismiss: (id: number) => {
    queue = queue.filter(t => t.id !== id);
    notifyQueue();
  },
};

// ---- presentation -----------------------------------------------------------

const STYLES: Record<ToastType, { colors: [string, string]; Icon: typeof CheckCircle2 }> = {
  success: { colors: ['#10B981', '#34D399'], Icon: CheckCircle2 },
  error: { colors: ['#F43F5E', '#FB923C'], Icon: XCircle },
  warning: { colors: ['#F59E0B', '#FBBF24'], Icon: TriangleAlert },
  info: { colors: ['#8b5cf6', '#61CDEA'], Icon: Info },
};

function ToastCard({ item }: { item: ToastItem }) {
  const anim = useRef(new Animated.Value(0)).current;
  const { colors, Icon } = STYLES[item.type];

  useEffect(() => {
    Animated.spring(anim, {
      toValue: item.leaving ? 0 : 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: item.leaving ? 0 : 7,
    }).start();
  }, [anim, item.leaving]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
        ],
      }}
    >
      <Pressable onPress={() => toast.dismiss(item.id)}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.card,
            Platform.OS === 'web'
              ? ({ boxShadow: `0 4px 12px ${colors[0]}59` } as any)
              : {
                  shadowColor: colors[0],
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 8,
                },
          ]}
        >
          <View style={styles.row}>
            <Icon color="#fff" size={22} />
            <View style={styles.textCol}>
              {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
              <Text style={styles.message} numberOfLines={3}>
                {item.message}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// Renders the toast queue. The root layout mounts one; any component hosting
// a native <Modal> can mount its own so toasts surface above the modal layer.
export function ToastViewport() {
  const insets = useSafeAreaInsets();
  const [, force] = useState(0);
  const idRef = useRef(0);

  useEffect(() => {
    const id = nextViewportId++;
    idRef.current = id;
    viewportStack = [...viewportStack, id];
    notifyViewports();
    const rerender = () => force(n => n + 1);
    queueListeners.add(rerender);
    viewportListeners.add(rerender);
    return () => {
      viewportStack = viewportStack.filter(v => v !== id);
      notifyViewports();
      queueListeners.delete(rerender);
      viewportListeners.delete(rerender);
    };
  }, []);

  const isTopmost = viewportStack[viewportStack.length - 1] === idRef.current;
  if (!isTopmost || queue.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.viewport, { top: insets.top + 8 }]}
    >
      {queue.map(t => (
        <ToastCard key={t.id} item={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  card: {
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
