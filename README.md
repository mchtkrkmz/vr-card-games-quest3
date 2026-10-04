# 🃏 VR 52 - Meta Quest 3 WebXR Batak & Pişti Oyunu

Meta Quest 3 WebXR tarayıcısı ve masaüstü/mobil cihazlar için geliştirilmiş, gerçekçi fizik animasyonlarına, Türk kıraathane atmosferine ve tam kural motoruna sahip 3D Kart Oyunu platformu.

---

## 🌟 Özellikler

### 1. 🥽 Meta Quest 3 ve WebXR Desteği
- **Tek Tıkla VR:** Quest 3 dahili Oculus/Meta Browser'ında `ENTER VR` butonuna basarak doğrudan masaya oturun.
- **6DoF Kontrolcü Desteği:** Lazer nişangahı ve tetik ile kartları doğrudan önünüzdeki kavisli desteden seçip masaya atın.
- **VR İçi 3D Skor Tahtası ve Menü:** İhale teklif butonları, koz seçimi ve canlı skorlar göz hizanızda 3D olarak yüzer.
- **Masaüstü & Mobil Hibrit:** VR başlığı olmadan da farenizle veya dokunmatik ekranla tam 3D oynayabilirsiniz.

### 2. ♠️ İhaleli Batak (Tam Kural Seti)
- 4 Kişilik (Siz + 3 Akıllı Yapay Zeka Bot veya Gerçek Oyuncular).
- **İhale Sistemi:** 5 ile 13 arası teklif verme ve pas geçme mekaniği. En yüksek teklifi veren oyuncu Kozu (♠ Maça, ♥ Kupa, ♦ Karo, ♣ Sinek) belirler.
- **Zorunlu Kurallar:**
  - Yere atılan rengi takip etme zorunluluğu.
  - Aynı renkten daha yüksek kart atma (büyütme) kuralı.
  - Renk yoksa **Koz atma (çakma)** zorunluluğu.
  - Koz açılmadan koz çekilememe kuralı.
- **Puanlama:** İhaleyi alan el sayısını tutturursa `(İhale * 10) + Fazla Eller`, batarsa `-(İhale * 10)` ceza puanı.

### 3. 🃏 Pişti (Tam Kural Seti)
- 2 veya 4 kişilik mod.
- Yerdeki tek karta aynı değerde kart atıldığında **PİŞTİ (+10 Puan)**.
- Tek Valenin üzerine Vale atıldığında **ÇİFT PİŞTİ (+20 Puan)**.
- Vale ile yerdeki desteyi kesip alma kuralı.
- **Özel Puan Kartları:** Karo 10 (+3 P), Sinek 2 (+2 P), Aslar (+1 P), Valeler (+1 P), Çoğunluk Kart Bonusu (+3 P).

### 4. 🌐 Çok Oyunculu (P2P Multiplayer)
- WebRTC Peer-to-Peer altyapısı sayesinde ek sunucu gerektirmeden 4 haneli oda koduyla arkadaşlarınızla aynı masada buluşma.

---

## 🚀 Çalıştırma ve Meta Quest 3'e Bağlanma

1. Bilgisayarınızda terminalden projeyi başlatın:
   ```bash
   npm run dev
   ```
2. **Meta Quest 3 Başlığınızdan Bağlanma:**
   - Quest 3 gözlüğünüzün ve bilgisayarınızın **aynı Wi-Fi ağına** bağlı olduğundan emin olun.
   - Quest 3'ün dahili **Meta Quest Browser** uygulamasını açın.
   - Adres çubuğuna bilgisayarınızın ağ IP adresini girin:
     `http://192.168.1.38:5173/` *(veya konsolda gösterilen Network IP)*
   - Ekranın altındaki **ENTER VR** butonuna basıp VR'a geçin.
