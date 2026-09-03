import React, { useState } from "react";
import { Modal, TouchableOpacity, ScrollView } from "react-native";
import { Box, HStack, Text, Icon, Pressable } from "@gluestack-ui/themed";
import { ChevronDown, Check } from "lucide-react-native";
import { AppColors } from "../../theme/colors";
import { LAYOUT } from "../../constants/layout";

const BORDER = "#E5E7EB";

export interface SelectFieldOption {
  label: string;
  value: string;
}

interface SelectFieldProps {
  value: string;
  onValueChange: (v: string) => void;
  items: SelectFieldOption[];
  placeholder?: string;
  readOnly?: boolean;
  title?: string;
  height?: number;
}

const SelectField = ({
  value,
  onValueChange,
  items,
  placeholder = "Select...",
  readOnly = false,
  title,
  height = 44,
}: SelectFieldProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = items.find((it) => it.value === value)?.label || "";

  return (
    <>
      <Pressable onPress={() => !readOnly && setIsOpen(true)}>
        <Box
          h={height}
          w="$full"
          rounded="$xl"
          borderWidth={1}
          borderColor={BORDER}
          bg="$white"
          px="$3"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          opacity={readOnly ? 0.5 : 1}
        >
          <Text fontSize={14} color={selectedLabel ? "#111827" : "#9CA3AF"} numberOfLines={1}>
            {selectedLabel || placeholder}
          </Text>
          <Icon as={ChevronDown} size="sm" color="#6B7280" />
        </Box>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}
          onPress={() => setIsOpen(false)}
        >
          <Pressable bg="$white" p="$3" rounded="$3xl" w="85%" maxHeight="70%" style={LAYOUT.dialogSurfaceStyle} onPress={() => {}}>
            {title ? (
              <Text fontWeight="$bold" fontSize={16} color="$coolGray900" px="$2" py="$2">
                {title}
              </Text>
            ) : null}
            <ScrollView showsVerticalScrollIndicator={false}>
              {items.map((it) => {
                const isSelected = it.value === value;
                return (
                  <TouchableOpacity
                    key={it.value}
                    onPress={() => {
                      onValueChange(it.value);
                      setIsOpen(false);
                    }}
                    style={{
                      borderRadius: 12,
                      marginVertical: 2,
                      backgroundColor: isSelected ? AppColors.accentPink : "transparent",
                    }}
                  >
                    <HStack alignItems="center" justifyContent="space-between" px="$3" py="$3">
                      <Text
                        fontSize={15}
                        fontWeight={isSelected ? "$bold" : "$normal"}
                        color={isSelected ? "$white" : "$coolGray800"}
                      >
                        {it.label}
                      </Text>
                      {isSelected && <Icon as={Check} size="sm" color="$white" />}
                    </HStack>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

export default SelectField;
