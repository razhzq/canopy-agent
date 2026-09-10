import type { enAccount } from "../en/account";

export const trAccount: Record<keyof typeof enAccount, string> = {
  gate_eyebrow: "Kapalı erişim",
  gate_unreachable_title: "Erişim doğrulanamıyor",
  gate_unreachable_body:
    "Erişiminizi kontrol etmek için Canopy'ye ulaşamadık. Bu, hesabınızla ilgili bir karar değil — kontrol yalnızca tamamlanamadı.",
  gate_locked_title: "Davet kodu gerekiyor",
  gate_locked_body:
    "Canopy Agent kapalı erişimde. Hesabınız oturum açtı — yalnızca henüz listede değil. Platformu açmak için size gönderilen kodu girin.",
  gate_code_label: "Davet kodu",
  gate_code_placeholder: "CANOPY-XXXX-XXXX",
  gate_checking: "Kontrol ediliyor…",
  gate_unlock: "Erişimi aç",
  gate_sign_out: "Çıkış yap",
  gate_session_expired: "Oturumunuzun süresi doldu. Tekrar giriş yapın.",
  gate_code_rejected: "Bu kod erişimi açmadı.",

  username_title: "Bir kullanıcı adı seçin",
  username_body:
    "Canopy'nin her yerinde e-postanızın yerini alır ve başkalarının sizi bulma yoludur.",
  username_placeholder: "adiniz",
  username_available: "@{name} uygun.",
  username_checking: "Kontrol ediliyor…",
  username_min_length: "En az 3 karakter.",
  username_charset: "Harf, rakam ve alt çizgi.",
  username_taken: "Bu ad alınmış.",
  username_later: "Sonra",
  username_claim: "Al",
  username_saving: "Kaydediliyor…",
  username_note: "Kullanıcı adları Canopy genelinde benzersizdir ve borsayla paylaşılır.",
};
