type ShopContactInfo = {
  ownerName?: string;
  shopName?: string;
  address?: string;
} | null | undefined;

export function buildSupportWhatsAppUrl(whatsappNumber: string, shop: ShopContactInfo): string {
  const who = [shop?.ownerName, shop?.shopName ? `from ${shop.shopName}` : null]
    .filter(Boolean)
    .join(' ');
  const addressLine = shop?.address ? ` Shop address: ${shop.address}.` : '';
  const message = `Hi${who ? `, I'm ${who}` : ''}.${addressLine} I need help with Gold Khata Book.`;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}
