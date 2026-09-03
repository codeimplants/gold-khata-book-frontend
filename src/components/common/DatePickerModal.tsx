import React, { useState, useEffect } from "react";
import { Modal, TouchableOpacity, ScrollView } from "react-native";
import {
    Box,
    VStack,
    HStack,
    Text,
    Icon,
    Pressable,
} from '@gluestack-ui/themed';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTranslation } from "../../hooks/useTranslation";
import { LAYOUT } from "../../constants/layout";

const PURPLE = '#6D5EF7';

interface DatePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: string;
    onSelect: (d: string) => void;
}

type SelectionMode = 'days' | 'months' | 'years';

const DatePickerModal = ({ isOpen, onClose, date, onSelect }: DatePickerModalProps) => {

    const today = new Date().toISOString().split('T')[0];
    const [viewDate, setViewDate] = useState(new Date(date || today));
    const [mode, setMode] = useState<SelectionMode>('days');

    useEffect(() => {
        if (isOpen) {
            setViewDate(new Date(date || today));
            setMode('days');
        }
    }, [isOpen, date, today]);

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const { t } = useTranslation();

    const rawMonths = t<string[] | string>('invoice.calendar.months');
    const rawDays = t<string[] | string>('invoice.calendar.days');

    const fallbackMonths = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const fallbackDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const monthNames = Array.isArray(rawMonths) ? rawMonths : fallbackMonths;
    const daysOfWeek = Array.isArray(rawDays) ? rawDays : fallbackDays;

    const selectDate = (day: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day + 1);
        onSelect(newDate.toISOString().split('T')[0]);
        onClose();
    };

    const changeMonth = (offset: number) => {
        setViewDate(prev => {
            const next = new Date(prev);
            next.setMonth(next.getMonth() + offset);
            return next;
        });
    };

    const jumpToToday = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dStr = `${year}-${month}-${day}`;
        onSelect(dStr);
        onClose();
    };

    const selectMonth = (idx: number) => {
        setViewDate(prev => {
            const next = new Date(prev);
            next.setMonth(idx);
            return next;
        });
        setMode('days');
    };

    const selectYear = (year: number) => {
        setViewDate(prev => {
            const next = new Date(prev);
            next.setFullYear(year);
            return next;
        });
        setMode('days');
    };

    const years = Array.from({ length: 41 }, (_, i) => new Date().getFullYear() - 20 + i);

    return (
        <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                onPress={onClose}
            >
                <Pressable
                    bg="$white"
                    p="$5"
                    rounded="$3xl"
                    w="90%"
                    maxHeight="80%"
                    style={LAYOUT.dialogSurfaceStyle}
                    onPress={() => { }}
                >
                    <HStack justifyContent="space-between" alignItems="center" mb="$4">
                        <HStack space="md" alignItems="center">
                            <TouchableOpacity onPress={() => setMode(mode === 'months' ? 'days' : 'months')}>
                                <HStack space="xs" alignItems="center">
                                    <Text fontWeight="$bold" fontSize="$lg" color={mode === 'months' ? PURPLE : '$coolGray900'}>
                                        {(monthNames[viewDate.getMonth()] || fallbackMonths[viewDate.getMonth()])}
                                    </Text>
                                    <Icon as={mode === 'months' ? ChevronUp : ChevronDown} size="xs" color="$coolGray400" />
                                </HStack>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setMode(mode === 'years' ? 'days' : 'years')}>
                                <HStack space="xs" alignItems="center">
                                    <Text fontWeight="$bold" fontSize="$lg" color={mode === 'years' ? PURPLE : '$coolGray900'}>
                                        {viewDate.getFullYear()}
                                    </Text>
                                    <Icon as={mode === 'years' ? ChevronUp : ChevronDown} size="xs" color="$coolGray400" />
                                </HStack>
                            </TouchableOpacity>
                        </HStack>
                        
                        {mode === 'days' && (
                            <HStack space="md">
                                <TouchableOpacity onPress={() => changeMonth(-1)}>
                                    <Icon as={ChevronDown} style={{ transform: [{ rotate: '90deg' }] }} size="sm" color={PURPLE} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => changeMonth(1)}>
                                    <Icon as={ChevronDown} style={{ transform: [{ rotate: '-90deg' }] }} size="sm" color={PURPLE} />
                                </TouchableOpacity>
                            </HStack>
                        )}
                    </HStack>

                    {mode === 'days' && (
                        <>
                            <HStack justifyContent="space-between" mb="$2">
                                {daysOfWeek.map((d, i) => (
                                    <Box key={i} w="14.2%" alignItems="center">
                                        <Text fontSize="$xs" color="$coolGray400" fontWeight="$bold">{d}</Text>
                                    </Box>
                                ))}
                            </HStack>
                            <HStack flexWrap="wrap">
                                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                                    <Box key={`empty-${i}`} w="14.2%" h={40} />
                                ))}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const dStr = new Date(viewDate.getFullYear(), viewDate.getMonth(), day + 1).toISOString().split('T')[0];
                                    const isSelected = date === dStr;
                                    const isToday = today === dStr;
                                    return (
                                        <TouchableOpacity
                                            key={day}
                                            onPress={() => selectDate(day)}
                                            style={{
                                                width: '14.2%',
                                                height: 40,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                backgroundColor: isSelected ? PURPLE : (isToday ? 'rgba(109, 94, 247, 0.1)' : 'transparent'),
                                                borderRadius: 12,
                                                borderWidth: isToday ? 1 : 0,
                                                borderColor: isToday ? PURPLE : 'transparent',
                                            }}
                                        >
                                            <Text
                                                fontWeight={isSelected || isToday ? "$bold" : "$normal"}
                                                color={isSelected ? '$white' : (isToday ? PURPLE : '$coolGray800')}
                                            >
                                                {day}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </HStack>
                        </>
                    )}

                    {mode === 'months' && (
                        <Box maxHeight={300}>
                            <HStack flexWrap="wrap" justifyContent="space-between">
                                {monthNames.map((m, i) => {
                                    const isSelected = viewDate.getMonth() === i;
                                    return (
                                        <TouchableOpacity
                                            key={i}
                                            onPress={() => selectMonth(i)}
                                            style={{
                                                width: '31%',
                                                paddingVertical: 12,
                                                marginBottom: 10,
                                                alignItems: 'center',
                                                backgroundColor: isSelected ? PURPLE : '$coolGray50',
                                                borderRadius: 12
                                            }}
                                        >
                                            <Text fontWeight={isSelected ? "$bold" : "$normal"} color={isSelected ? '$white' : '$coolGray700'} fontSize="$sm">
                                                {m}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </HStack>
                        </Box>
                    )}

                    {mode === 'years' && (
                        <Box maxHeight={300}>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <HStack flexWrap="wrap" justifyContent="space-between">
                                    {years.map((y) => {
                                        const isSelected = viewDate.getFullYear() === y;
                                        return (
                                            <TouchableOpacity
                                                key={y}
                                                onPress={() => selectYear(y)}
                                                style={{
                                                    width: '31%',
                                                    paddingVertical: 12,
                                                    marginBottom: 10,
                                                    alignItems: 'center',
                                                    backgroundColor: isSelected ? PURPLE : '$coolGray50',
                                                    borderRadius: 12
                                                }}
                                            >
                                                <Text fontWeight={isSelected ? "$bold" : "$normal"} color={isSelected ? '$white' : '$coolGray700'} fontSize="$sm">
                                                    {y}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </HStack>
                            </ScrollView>
                        </Box>
                    )}

                    <HStack space="md" mt="$5">
                        <TouchableOpacity
                            onPress={jumpToToday}
                            style={{ flex: 1, padding: 12, backgroundColor: 'rgba(109, 94, 247, 0.05)', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(109, 94, 247, 0.2)' }}
                        >
                            <Text fontWeight="$bold" color={PURPLE}>{t('common.today') || "Today"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onClose}
                            style={{ flex: 1, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 12, alignItems: 'center' }}
                        >
                            <Text fontWeight="$bold" color="$coolGray500">{t('common.cancel')}</Text>
                        </TouchableOpacity>
                    </HStack>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

export default DatePickerModal;
