-- =============================================
-- 001: DB CHECK制約の追加
-- Supabase Dashboard > SQL Editor で実行
--
-- 既存データに違反がある場合はエラーになります。
-- 先に確認クエリで違反データがないか調べてから実行してください。
-- =============================================

-- === 確認クエリ（先に実行して違反データを確認） ===
-- SELECT id, amount FROM advances WHERE amount <= 0 OR amount > 10000000;
-- SELECT id, amount FROM settlements WHERE amount <= 0 OR amount > 10000000;
-- SELECT id, fee_per_person FROM events WHERE fee_per_person IS NOT NULL AND fee_per_person <= 0;
-- SELECT id, paypay_phone FROM participants WHERE paypay_phone IS NOT NULL AND paypay_phone !~ '^\d{2,4}-?\d{2,4}-?\d{3,4}$';
-- SELECT id, char_length(title) FROM events WHERE char_length(title) > 200;

-- === 金額制約 ===
ALTER TABLE advances
  ADD CONSTRAINT advances_amount_positive
  CHECK (amount > 0 AND amount <= 10000000);

ALTER TABLE settlements
  ADD CONSTRAINT settlements_amount_positive
  CHECK (amount > 0 AND amount <= 10000000);

ALTER TABLE events
  ADD CONSTRAINT events_fee_positive
  CHECK (fee_per_person IS NULL OR (fee_per_person > 0 AND fee_per_person <= 10000000));

-- === PayPay番号フォーマット（数字のみ or ハイフン区切り、9〜13桁） ===
ALTER TABLE participants
  ADD CONSTRAINT participants_paypay_format
  CHECK (paypay_phone IS NULL OR paypay_phone ~ '^[\d-]{9,15}$');

-- === テキスト長制限 ===
ALTER TABLE events
  ADD CONSTRAINT events_title_length CHECK (char_length(title) <= 200);

ALTER TABLE events
  ADD CONSTRAINT events_venue_length CHECK (venue_name IS NULL OR char_length(venue_name) <= 200);

ALTER TABLE events
  ADD CONSTRAINT events_memo_length CHECK (memo IS NULL OR char_length(memo) <= 2000);

ALTER TABLE advances
  ADD CONSTRAINT advances_description_length CHECK (description IS NULL OR char_length(description) <= 500);

ALTER TABLE advances
  ADD CONSTRAINT advances_payer_length CHECK (char_length(payer_name) <= 100);

ALTER TABLE participants
  ADD CONSTRAINT participants_name_length CHECK (char_length(name) <= 100);

ALTER TABLE contacts
  ADD CONSTRAINT contacts_name_length CHECK (char_length(name) <= 200);

ALTER TABLE contacts
  ADD CONSTRAINT contacts_email_length CHECK (char_length(email) <= 254);

ALTER TABLE contacts
  ADD CONSTRAINT contacts_message_length CHECK (char_length(message) <= 5000);
