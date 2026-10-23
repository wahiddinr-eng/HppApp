import Link from "next/link";
import styles from "./checkout.module.css";

export function CheckoutBrand() {
  return <Link href="/" className={styles.brand} aria-label="KulinerKit by LRMobileID — beranda">
    <span className={styles.brandMark} aria-hidden="true">k<span>k</span></span>
    <span className={styles.brandName}>KulinerKit<small>by LRMobileID</small></span>
  </Link>;
}
