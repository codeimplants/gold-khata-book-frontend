import React from "react";
import { ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Box,
  HStack,
  Pressable,
  Text,
  VStack,
  Icon,
  Center,
} from "@gluestack-ui/themed";
import CommonHeader from "../../components/CommonHeader";
import LanguagePicker from "../../components/common/LanguagePicker";
import { Globe, Check } from "lucide-react-native";
import { useTranslation } from "../../hooks/useTranslation";
import { LAYOUT } from "../../constants/layout";

type LangKey = "en" | "hi" | "mr" | "gu";

const LanguageScreen = () => {
  const navigation = useNavigation();
  const {
    language,
    setLanguage,
    t,
    declarationLanguage,
    setDeclarationLanguage,
    declarationLanguageIsExplicit,
  } = useTranslation();

  const Row = ({
    title,
    sub,
    value,
  }: {
    title: string;
    sub: string;
    value: LangKey;
  }) => {
    const selected = language === value;

    return (
      <Pressable onPress={() => setLanguage(value)}>
        <Box
          bg="$white"
          rounded="$2xl"
          borderWidth={selected ? 2.5 : 1}
          borderColor={selected ? "#6D5EF7" : "#E5E7EB"}
          hardShadow="1"
          style={{ padding: 14 }}
        >
          <HStack alignItems="center" justifyContent="space-between">
            <HStack alignItems="center" space="md">
              <Center
                bg="#F1E9FF"
                rounded="$full"
                style={{ width: 52, height: 52 }}
              >
                <Icon as={Globe} size="xl" color="#6D5EF7" />
              </Center>

              <VStack style={{ gap: 2 }}>
                <Text
                  fontWeight="$bold"
                  color="$coolGray900"
                  style={{ fontSize: 18, lineHeight: 22 }}
                >
                  {title}
                </Text>

                <Text
                  color="$coolGray500"
                  style={{ fontSize: 14, lineHeight: 18 }}
                >
                  {sub}
                </Text>
              </VStack>
            </HStack>

            <Center
              rounded="$full"
              style={{ width: 40, height: 40 }}
              bg={selected ? "#6D5EF7" : "transparent"}
            >
              {selected && <Icon as={Check} size="lg" color="$white" />}
            </Center>
          </HStack>
        </Box>
      </Pressable>
    );
  };

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        title={t("language.title")}
        subtitle={t("language.subtitle")}
        variant="light"
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={[
          { padding: 16, paddingBottom: 32 },
          LAYOUT.isWeb && LAYOUT.contentContainerStyle,
        ]}
      >
        <VStack style={{ gap: 12 }}>
          <Row title="English" sub="English" value="en" />
          <Row title="मराठी" sub="Marathi" value="mr" />
          <Row title="हिंदी" sub="Hindi" value="hi" />
          <Row title="ગુજરાતી" sub="Gujarati" value="gu" />
        </VStack>

        {/* The customer signs the declaration; the shopkeeper reads the app.
            A shop whose sellers all read Marathi sets this once instead of
            re-picking it on every declaration — the form still overrides it
            for the occasional exception. */}
        <Box mt="$6">
          <Box
            bg="$white"
            rounded="$2xl"
            borderWidth={1}
            borderColor="#E5E7EB"
            hardShadow="1"
            style={{ padding: 16 }}
          >
            <LanguagePicker
              value={declarationLanguage as any}
              onChange={lang => setDeclarationLanguage(lang as LangKey)}
              title={t("language.declaration.title") || "Declaration Language"}
              hint={
                declarationLanguageIsExplicit
                  ? t("language.declaration.hint")
                  : t("language.declaration.hintFollowingApp")
              }
            />
          </Box>
        </Box>
      </ScrollView>
    </Box>
  );
};

export default LanguageScreen;
