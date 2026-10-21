BEGIN;

DO $$
DECLARE
  old_product CONSTANT text := 'prd_9cc3338c-9177-4e0e-a3c1-207bcd54d390';
  bundle_product CONSTANT text := 'prd_344a58e2-23f3-4c33-84d0-cf0f9c52f9d0';
  card_count integer;
  moved_count integer;
BEGIN
  IF (SELECT count(*) FROM prompt_gallery_collection WHERE product_id = old_product) <> 1
     OR (SELECT count(*) FROM prompt_gallery_collection WHERE product_id = bundle_product) <> 0
     OR (SELECT count(*) FROM access_grant WHERE product_id IN (old_product, bundle_product)) <> 0 THEN
    RAISE EXCEPTION 'Galeri atau grant tidak sesuai keadaan pra-integrasi';
  END IF;

  SELECT count(*) INTO card_count FROM prompt_gallery_card WHERE product_id = old_product;
  IF card_count <> 26 THEN
    RAISE EXCEPTION 'Jumlah kartu lama berubah: %', card_count;
  END IF;

  INSERT INTO prompt_gallery_collection(product_id, name, description)
    SELECT bundle_product, 'Kuliner Kit', description
      FROM prompt_gallery_collection WHERE product_id = old_product;

  UPDATE prompt_gallery_card SET product_id = bundle_product WHERE product_id = old_product;
  GET DIAGNOSTICS moved_count = ROW_COUNT;
  IF moved_count <> card_count THEN
    RAISE EXCEPTION 'Kartu yang dipindahkan tidak sesuai: %', moved_count;
  END IF;

  DELETE FROM prompt_gallery_collection WHERE product_id = old_product;
  INSERT INTO audit_log(action, target, reason)
    VALUES ('prompt_gallery_product_mapped', bundle_product, 'one_product_checkout');
END
$$;

COMMIT;
