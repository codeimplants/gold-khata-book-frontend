import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, TextInput } from 'react-native';
import { Box, HStack, VStack, Text, Pressable } from '@gluestack-ui/themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, LogOut, Search, Shield, Users, X } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/types';
import { useAppDispatch } from '../../store/hooks';
import { logout, startImpersonation } from '../../store/auth/authSlice';
import { clearUserData } from '../../store/data/dataSlice';
import { adminService, ApiDukandarStats } from '../../services/authService';
import { INPUT_LIMITS } from '../../constants/inputLimits';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminHome'>;

const AVATAR_COLORS = ['#7C3AED', '#4F46E5', '#0D9488', '#D97706', '#E11D48', '#0284C7'];
const avatarColor = (name: string) => AVATAR_COLORS[(name || 'S').charCodeAt(0) % AVATAR_COLORS.length];

/**
 * Where an admin lands in the app, now that the admin dashboard lives in Nexus.
 *
 * The dashboard moved out because it was the second place to look: Nexus held
 * the telemetry, this screen held the business data, and answering one ordinary
 * question meant opening both. What could not move is impersonation — browsing
 * the real app as a shop is the app being the app, and Nexus's read-only
 * view-as summarises a shop rather than reproducing 25,000 lines of screens.
 *
 * So this is deliberately one job: pick a shop and open it. Everything else an
 * admin used to do here — counts, cohorts, pending signups, deletions, feature
 * flags — is in Nexus, and the notice below says so rather than leaving someone
 * hunting for tabs that are gone.
 */
const AdminHomeScreen: React.FC<Props> = () => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState<ApiDukandarStats[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await adminService.listUsersWithStats();
      setUsers(res.data ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      u => String(u.phone).includes(q) || (u.shopName ?? '').toLowerCase().includes(q),
    );
  }, [users, search]);

  const impersonate = (user: ApiDukandarStats) => {
    // Clear first: the previous session's cached shop data must not bleed into
    // the one being opened.
    dispatch(clearUserData());
    dispatch(startImpersonation({ userId: String(user._id), phone: String(user.phone) }));
  };

  return (
    <Box flex={1} style={{ backgroundColor: '#F8F9FF', paddingTop: insets.top }}>
      <Box style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
        <HStack alignItems="flex-start" justifyContent="space-between" mb="$4">
          <HStack space="md" alignItems="center" flex={1}>
            <Box
              w={44} h={44} rounded="$2xl" alignItems="center" justifyContent="center"
              style={{ backgroundColor: '#7C5CFF' }}
            >
              <Shield size={22} color="#FFFFFF" />
            </Box>
            <VStack flex={1}>
              <Text fontWeight="$bold" fontSize="$xl" color="$coolGray900">Admin</Text>
              <Text color="$coolGray500" fontSize="$sm">
                {loading ? 'Loading shops…' : `${users.length} shop${users.length === 1 ? '' : 's'}`}
              </Text>
            </VStack>
          </HStack>
          <Pressable
            onPress={() => dispatch(logout())}
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1,
              borderColor: '#F5A5BA', paddingVertical: 8, paddingHorizontal: 16,
              flexDirection: 'row', alignItems: 'center',
            }}
          >
            <LogOut size={16} color="#F43F5E" />
            <Text color="#F43F5E" fontSize="$xs" fontWeight="$semibold" ml="$1">Logout</Text>
          </Pressable>
        </HStack>

        {/* Says where the dashboard went. Without this the missing tabs read as
            a broken build rather than a deliberate move. */}
        <Box
          rounded="$2xl" p="$3" mb="$3" borderWidth={1}
          style={{ backgroundColor: 'rgba(124, 92, 255, 0.06)', borderColor: 'rgba(124, 92, 255, 0.2)' }}
        >
          <Text color="#5B21B6" fontSize="$xs" fontWeight="$medium">
            Shop stats, pending signups, deletions and feature flags are in Nexus now.
            This screen opens a shop so you can see the app exactly as they do.
          </Text>
        </Box>

        <HStack
          alignItems="center" bg="$white" rounded="$xl" borderWidth={1}
          borderColor="$coolGray200" px="$3" h={44} space="sm" mb="$2"
        >
          <Search size={16} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by phone or shop name…"
            placeholderTextColor="#9CA3AF"
            maxLength={INPUT_LIMITS.searchQuery}
            style={{ flex: 1, fontSize: 14, color: '#111827', padding: 0 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} p="$1">
              <X size={14} color="#9CA3AF" />
            </Pressable>
          )}
        </HStack>
      </Box>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item._id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 8 }}
        ListEmptyComponent={() => (
          <VStack alignItems="center" py="$12" space="sm">
            <Users size={36} color="#D1D5DB" />
            <Text color="$coolGray500" fontSize="$sm">
              {loading ? 'Loading…' : failed ? 'Could not load shops' : 'No shops found'}
            </Text>
            {failed && (
              <Pressable onPress={load} mt="$2">
                <Text color="#7C5CFF" fontWeight="$semibold" fontSize="$sm">Try again</Text>
              </Pressable>
            )}
          </VStack>
        )}
        renderItem={({ item }) => {
          const name = item.shopName?.trim() || `Shop #${String(item._id).slice(-4)}`;
          return (
            <Pressable onPress={() => impersonate(item)}>
              <Box bg="$white" rounded="$xl" p="$3" borderWidth={1} borderColor="$coolGray100">
                <HStack alignItems="center" space="md">
                  <Box
                    w={40} h={40} rounded="$xl" alignItems="center" justifyContent="center"
                    style={{ backgroundColor: avatarColor(name) }}
                  >
                    <Text color="$white" fontWeight="$bold" fontSize="$sm">
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </Box>
                  <VStack flex={1}>
                    <Text fontWeight="$semibold" fontSize="$sm" numberOfLines={1}>{name}</Text>
                    <Text color="$coolGray500" fontSize="$xs" numberOfLines={1}>
                      +91 {item.phone} ·{' '}
                      <Text color="#0D9488" fontWeight="$semibold" fontSize="$xs">
                        {item.totalInvoices} bills
                      </Text>
                    </Text>
                  </VStack>
                  <ArrowRight size={16} color="#D1D5DB" />
                </HStack>
              </Box>
            </Pressable>
          );
        }}
      />
    </Box>
  );
};

export default AdminHomeScreen;
