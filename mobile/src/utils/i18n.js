/**
 * Fetno - Bilingual String System (English / Amharic አማርኛ)
 * Usage: t('welcome') or t('welcome', 'am')
 */

const strings = {
  // ─── App ─────────────────────────────────────────────────────────────────
  appName:       { en: 'Fetno', am: 'Fetno' },
  tagline:       { en: "Ethiopia's Delivery Network", am: 'የኢትዮጵያ የማድረስ አውታር' },
  madeInEthiopia:{ en: '🇪🇹 Made in Ethiopia', am: '🇪🇹 በኢትዮጵያ የተሰራ' },

  // ─── Auth ─────────────────────────────────────────────────────────────────
  welcomeBack:   { en: 'Welcome Back!', am: 'እንኳን ደህና መጡ!' },
  enterPhone:    { en: 'Enter your phone number', am: 'ስልክ ቁጥርዎን ያስገቡ' },
  phoneNumber:   { en: 'Phone Number', am: 'ስልክ ቁጥር' },
  phonePlaceholder:{ en: '+251 9XX XXX XXX', am: '+251 9XX XXX XXX' },
  sendCode:      { en: 'Send Verification Code', am: 'የማረጋገጫ ኮድ ላክ' },
  enterOtp:      { en: 'Enter Verification Code', am: 'የማረጋገጫ ኮድ ያስገቡ' },
  otpSent:       { en: 'Code sent to', am: 'ኮድ ተልኳል ወደ' },
  otpResend:     { en: "Didn't receive it? Resend", am: 'አልደረሰዎትም? እንደገና ላክ' },
  verify:        { en: 'Verify', am: 'አረጋግጥ' },
  login:         { en: 'Login', am: 'ግባ' },
  logout:        { en: 'Logout', am: 'ውጣ' },
  register:      { en: 'Register', am: 'ይመዝገቡ' },
  noAccount:     { en: "Don't have an account?", am: 'መለያ የለዎትም?' },
  haveAccount:   { en: 'Already have an account?', am: 'መለያ አለዎት?' },
  signIn:        { en: 'Sign in', am: 'ይግቡ' },
  signUp:        { en: 'Sign up', am: 'ይመዝገቡ' },

  // ─── Registration ─────────────────────────────────────────────────────────
  createAccount: { en: 'Create Account', am: 'መለያ ይፍጠሩ' },
  fullName:      { en: 'Full Name', am: 'ሙሉ ስም' },
  fullNamePlaceholder: { en: 'e.g. Abebe Bekele', am: 'ለምሳሌ: አበበ በቀለ' },
  email:         { en: 'Email (optional)', am: 'ኢሜይል (አማራጭ)' },
  iAmDriver:     { en: "I'm a Driver", am: 'ሾፌር ነኝ' },
  iAmStore:      { en: "I'm a Store Owner", am: 'የመደብር ባለቤት ነኝ' },
  next:          { en: 'Next', am: 'ቀጥል' },
  back:          { en: 'Back', am: 'ተመለስ' },
  submit:        { en: 'Submit', am: 'አስገባ' },
  finish:        { en: 'Finish', am: 'ጨርስ' },

  // ─── Driver Registration Steps ────────────────────────────────────────────
  driverRegTitle:{ en: 'Driver Registration', am: 'የሾፌር ምዝገባ' },
  step:          { en: 'Step', am: 'ደረጃ' },
  of:            { en: 'of', am: 'ከ' },
  vehicleInfo:   { en: 'Vehicle Information', am: 'የተሽከርካሪ መረጃ' },
  vehicleType:   { en: 'Vehicle Type', am: 'የተሽከርካሪ አይነት' },
  vehiclePlate:  { en: 'License Plate', am: 'የሰሌዳ ቁጥር' },
  vehicleModel:  { en: 'Vehicle Model', am: 'የተሽከርካሪ ሞዴል' },
  vehicleColor:  { en: 'Color', am: 'ቀለም' },
  vehicleYear:   { en: 'Year', am: 'ዓመት' },
  licenseInfo:   { en: 'License Information', am: 'የፍቃድ መረጃ' },
  licenseNumber: { en: 'License Number', am: 'የፍቃድ ቁጥር' },
  licenseExpiry: { en: 'License Expiry Date', am: 'የፍቃድ ማብቂያ ቀን' },
  selectCity:    { en: 'Select City', am: 'ከተማ ይምረጡ' },
  documents:     { en: 'Documents', am: 'ሰነዶች' },
  uploadLicense: { en: 'Upload Driver License', am: 'የሾፌር ፍቃድ ስዕል ያስገቡ' },
  uploadId:      { en: 'Upload National ID', am: 'የሀገር መታወቂያ ስዕል ያስገቡ' },
  tapToUpload:   { en: 'Tap to upload photo', am: 'ፎቶ ለመስቀል ይጫኑ' },
  submitted:     { en: 'Application Submitted!', am: 'ማመልከቻ ተልኳል!' },
  waitApproval:  { en: 'Your application is under review. We will notify you within 24 hours.', am: 'ማመልከቻዎ በግምገማ ላይ ነው። በ24 ሰዓት ውስጥ እናሳውቀዎታለን።' },

  // ─── Home ─────────────────────────────────────────────────────────────────
  online:        { en: 'Online', am: 'ኦንላይን' },
  offline:       { en: 'Offline', am: 'ኦፍላይን' },
  goOnline:      { en: 'Go Online to Receive Orders', am: 'ትዕዛዝ ለመቀበል ኦንላይን ይሁኑ' },
  receiving:     { en: 'You are receiving orders', am: 'ትዕዛዞችን እየተቀበሉ ነዎት' },
  nearbyOrders:  { en: 'Nearby Orders', am: 'አቅራቢያ ያሉ ትዕዛዞች' },
  noNearbyOrders:{ en: 'No deliveries nearby', am: 'አቅራቢያ ምንም ማድረስ የለም' },
  activeDelivery:{ en: 'Active Delivery', am: 'ንቁ ማድረስ' },
  tapToContinue: { en: 'Tap to continue', am: 'ለመቀጠል ይጫኑ' },
  pendingApproval:{ en: 'Pending Approval — Your application is being reviewed', am: 'ጸድቆ በመጠባበቅ ላይ — ማመልከቻዎ ይገመገማል' },

  // ─── Orders ───────────────────────────────────────────────────────────────
  acceptDelivery:{ en: 'Accept Delivery', am: 'ማድረስ ተቀበል' },
  declineDelivery:{ en: 'Decline', am: 'አትቀበል' },
  orderNumber:   { en: 'Order', am: 'ትዕዛዝ' },
  pickup:        { en: 'Pickup', am: 'መነሻ' },
  delivery:      { en: 'Delivery', am: 'መድረሻ' },
  distance:      { en: 'Distance', am: 'ርቀት' },
  yourEarnings:  { en: 'Your Earnings', am: 'ያገኛሉ' },
  navigatePickup:{ en: 'Navigate to Pickup', am: 'ወደ መነሻ ይሂዱ' },
  navigateDelivery:{ en: 'Navigate to Delivery', am: 'ወደ መድረሻ ይሂዱ' },
  callRecipient: { en: 'Call Recipient', am: 'ተቀባዩን ይደውሉ' },
  cargoDetails:  { en: 'Cargo Details', am: 'ጭነት ዝርዝር' },
  fragile:       { en: '⚠️ Fragile — Handle with Care!', am: '⚠️ ስስ ነው — በጥንቃቄ ይያዙ!' },
  refrigeration: { en: '❄️ Requires Refrigeration!', am: '❄️ ቀዝቃዛ ቦታ ያስፈልጋል!' },
  surgeActive:   { en: '🔥 Surge Pricing Active', am: '🔥 ከፍተኛ ዋጋ ይጠቀሳል' },

  // ─── Status Labels ────────────────────────────────────────────────────────
  status_PENDING:           { en: 'Pending', am: 'በመጠባበቅ ላይ' },
  status_SEARCHING_DRIVER:  { en: 'Finding Driver', am: 'ሾፌር በመፈለግ ላይ' },
  status_DRIVER_ASSIGNED:   { en: 'Driver Assigned', am: 'ሾፌር ተመድቧል' },
  status_DRIVER_AT_STORE:   { en: 'Driver at Pickup', am: 'ሾፌር መነሻ ደርሷል' },
  status_PICKED_UP:         { en: 'Picked Up', am: 'ተወሷል' },
  status_IN_TRANSIT:        { en: 'On the Way', am: 'በመጓዝ ላይ' },
  status_DELIVERED:         { en: 'Delivered ✅', am: 'ደርሷል ✅' },
  status_CANCELLED:         { en: 'Cancelled', am: 'ተሰርዟል' },
  status_FAILED:            { en: 'Failed', am: 'አልተሳካም' },

  // ─── Earnings / Wallet ────────────────────────────────────────────────────
  earnings:      { en: 'Earnings', am: 'ገቢ' },
  todayEarnings: { en: "Today's Earnings", am: 'ዛሬ ያገኘሁት' },
  totalEarned:   { en: 'Total Earned', am: 'ጠቅላላ ያገኘሁት' },
  trips:         { en: 'Trips', am: 'ጉዞዎች' },
  avgPerTrip:    { en: 'Avg per Trip', am: 'በጉዞ አማካይ' },
  wallet:        { en: 'Wallet', am: 'የገንዘብ ቦርሳ' },
  balance:       { en: 'Available Balance', am: 'ያለ ቀሪ' },
  pending:       { en: 'Pending', am: 'በጸጸጸጸ ላይ' },
  withdraw:      { en: 'Withdraw', am: 'አውጣ' },
  withdrawFunds: { en: 'Withdraw Funds', am: 'ገንዘብ አውጡ' },
  minWithdrawal: { en: 'Minimum withdrawal: ETB 100', am: 'አነስተኛ ክፍያ: 100 ብር' },
  accountNumber: { en: 'Account Number / Phone', am: 'የሂሳብ ቁጥር / ስልክ' },
  accountName:   { en: 'Account Holder Name', am: 'የሂሳብ ባለቤት ስም' },

  // ─── Chat ─────────────────────────────────────────────────────────────────
  chat:          { en: 'Chat', am: 'ውይይት' },
  typeMessage:   { en: 'Type a message...', am: 'መልዕክት ይፃፉ...' },
  send:          { en: 'Send', am: 'ላክ' },
  noMessages:    { en: 'No messages yet. Say hello!', am: 'ምንም መልዕክት የለም። ሰላም ይበሉ!' },

  // ─── Profile ──────────────────────────────────────────────────────────────
  profile:       { en: 'Profile', am: 'መገለጫ' },
  myVehicle:     { en: 'My Vehicle', am: 'የእኔ ተሽከርካሪ' },
  deliveryHistory:{ en: 'Delivery History', am: 'የማድረስ ታሪክ' },
  notifications: { en: 'Notifications', am: 'ማሳወቂያዎች' },
  helpSupport:   { en: 'Help & Support', am: 'እርዳታ' },
  settings:      { en: 'Settings', am: 'ቅንብሮች' },
  language:      { en: 'Language / ቋንቋ', am: 'ቋንቋ / Language' },
  appVersion:    { en: 'App Version', am: 'የፕሮግራም ስሪት' },

  // ─── Common ───────────────────────────────────────────────────────────────
  loading:       { en: 'Loading...', am: 'እየጫነ ነው...' },
  error:         { en: 'Something went wrong', am: 'የሆነ ስህተት ተከስቷል' },
  retry:         { en: 'Retry', am: 'እንደገና ሞክር' },
  cancel:        { en: 'Cancel', am: 'ሰርዝ' },
  confirm:       { en: 'Confirm', am: 'አረጋግጥ' },
  yes:           { en: 'Yes', am: 'አዎ' },
  no:            { en: 'No', am: 'አይ' },
  save:          { en: 'Save', am: 'አስቀምጥ' },
  edit:          { en: 'Edit', am: 'አርትዕ' },
  delete:        { en: 'Delete', am: 'ሰርዝ' },
  search:        { en: 'Search', am: 'ፈልግ' },
  currency:      { en: 'ETB', am: 'ብር' },
};

/**
 * Translate a key. Current language lives in Redux (state.settings.language) —
 * read it with useSelector and pass it in, e.g. t('welcome', language).
 * @param {string} key - string key
 * @param {string} [lang] - language ('en' | 'am'), defaults to Amharic
 */
export const t = (key, lang = 'am') => {
  return strings[key]?.[lang] || strings[key]?.['en'] || key;
};

/**
 * Get both translations
 */
export const both = (key) => ({
  en: strings[key]?.en || key,
  am: strings[key]?.am || key,
});

export default strings;
