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
  ok:            { en: 'OK', am: 'እሺ' },
  errorTitle:    { en: 'Error', am: 'ስህተት' },
  navigate:      { en: 'Navigate', am: 'ይምሩ' },
  call:          { en: 'Call', am: 'ደውል' },
  note:          { en: 'Note', am: 'ማስታወሻ' },
  weight:        { en: 'Weight', am: 'ክብደት' },

  // ─── Home screen ────────────────────────────────────────────────────────────
  locPermTitle:  { en: 'Location Permission Needed', am: 'የአካባቢ ፍቃድ ያስፈልጋል' },
  locPermBody:   { en: 'Please enable location access in Settings to receive more delivery offers.', am: 'ተጨማሪ ትዕዛዞችን ለመቀበል እባክዎ በቅንብሮች ውስጥ የአካባቢ መዳረሻን ያንቁ።' },
  openSettings:  { en: 'Open Settings', am: 'ቅንብሮችን ክፈት' },
  locAlreadyOnTitle: { en: 'Already Enabled', am: 'አስቀድሞ ነቅቷል' },
  locAlreadyOnBody:  { en: "You're all set — background location sharing is on.", am: 'ሁሉም ዝግጁ ነው — የበስተጀርባ አካባቢ ማጋራት በርቷል።' },
  locAlwaysTitle: { en: 'Allow "Always" Location', am: '"ሁልጊዜ" የአካባቢ ፍቃድ ይፍቀዱ' },
  locAlwaysBody:  { en: 'Enable "Always" location access in Settings so you keep getting offers even when the app is in the background.', am: 'መተግበሪያው በበስተጀርባ ሆኖም ትዕዛዞችን መቀበልዎን እንዲቀጥሉ በቅንብሮች ውስጥ "ሁልጊዜ" የአካባቢ ፍቃድን ያንቁ።' },
  locEnabledTitle: { en: 'Location Sharing Enabled', am: 'የአካባቢ ማጋራት ነቅቷል' },
  locEnabledBody:  { en: "You'll now get matched with more delivery offers, even in the background.", am: 'ከአሁን በኋላ መተግበሪያው በበስተጀርባ ሆኖም ተጨማሪ የማድረስ ትዕዛዞች ያገኛሉ።' },
  locForegroundOnlyTitle: { en: 'Foreground Only', am: 'በፊት ገፅ ብቻ' },
  locForegroundOnlyBody:  { en: "Background access wasn't granted, so your location only updates while the app is open.", am: 'የበስተጀርባ ፍቃድ አልተሰጠም፣ ስለዚህ አካባቢዎ የሚዘምነው መተግበሪያው ክፍት ሲሆን ብቻ ነው።' },
  locErrorBody:  { en: 'Could not update location settings. Please try again.', am: 'የአካባቢ ቅንብሮችን ማዘመን አልተቻለም። እባክዎ እንደገና ይሞክሩ።' },
  pendingApprovalTitle: { en: 'Pending Approval', am: 'ማጽደቅ በመጠባበቅ ላይ' },
  pendingApprovalBody:  { en: 'Your driver application is still being reviewed.', am: 'የሾፌር ማመልከቻዎ አሁንም እየተገመገመ ነው።' },
  appNotApprovedTitle:  { en: 'Application Not Approved', am: 'ማመልከቻ አልጸደቀም' },
  contactSupport:       { en: 'Contact support for more information.', am: 'ለተጨማሪ መረጃ ድጋፍን ያግኙ።' },
  updateStatusFailed:   { en: 'Failed to update status', am: 'ሁኔታን ማዘመን አልተሳካም' },
  goOfflineFailed:      { en: 'Failed to go offline', am: 'ኦፍላይን መሆን አልተሳካም' },
  surgeActiveAlertTitle:{ en: '🔥 Surge Active', am: '🔥 ከፍተኛ ዋጋ ነቅቷል' },
  surgeMultiplierBody:  { en: '{x}x earnings now!', am: 'አሁን {x}x ገቢ!' },
  adminAccountTitle:    { en: 'Admin Account', am: 'የአስተዳዳሪ መለያ' },
  adminAccountBody:     { en: 'Use the web dashboard for admin controls.', am: 'ለአስተዳዳሪ ቁጥጥሮች የድር ዳሽቦርድን ይጠቀሙ።' },
  onlineBannerMsg:      { en: "You're online! Offers will appear here.", am: 'ኦንላይን ነዎት! ትዕዛዞች እዚህ ይታያሉ።' },
  sparkNow:             { en: 'SPARK NOW', am: 'አሁን ጀምር' },
  goOfflineCaps:        { en: 'GO OFFLINE', am: 'ኦፍላይን ሁን' },
  dayStreak:            { en: 'Day Streak', am: 'ተከታታይ ቀናት' },
  pendingReviewMsg:     { en: "⏳ Application under review — you'll be notified once approved.", am: '⏳ ማመልከቻ በግምገማ ላይ ነው — ከጸደቀ በኋላ ይነገርዎታል።' },
  appNotApprovedMsg:    { en: '✕ Application not approved', am: '✕ ማመልከቻ አልጸደቀም' },
  dailyGoal:            { en: 'Daily Goal', am: 'ዕለታዊ ግብ' },
  dailyGoalReached:     { en: '🎉 Daily goal reached!', am: '🎉 ዕለታዊ ግብ ደርሷል!' },
  gettingMoreOffers:    { en: 'Getting more offers', am: 'ተጨማሪ ትዕዛዞችን ማግኘት' },
  gettingMoreOffersBody:{ en: 'Setting your location access to always sharing helps get more offers.', am: 'የአካባቢ መዳረሻዎን ሁልጊዜ ማጋራት ላይ ማዘጋጀት ተጨማሪ ትዕዛዞችን እንዲያገኙ ይረዳል።' },
  newOffersNearby:      { en: 'New offers nearby', am: 'አዳዲስ ትዕዛዞች በአቅራቢያ' },
  lookingForOffers:     { en: 'Looking for offers', am: 'ትዕዛዞችን በመፈለግ ላይ' },
  lookingForOffersBody: { en: 'Stay in a busy area to receive more delivery offers.', am: 'ተጨማሪ ትዕዛዞችን ለመቀበል በተጨናነቀ አካባቢ ይቆዩ።' },
  popularOfferTimes:    { en: 'Popular offer times: Today', am: 'ታዋቂ የትዕዛዝ ሰዓቶች፡ ዛሬ' },
  basedOnOrders:        { en: 'Based on {n} past orders', am: 'በ{n} ያለፉ ትዕዛዞች መሰረት' },
  typicalBusyHours:     { en: 'Typical busy hours (general guide)', am: 'የተለመዱ የስራ ሰዓቶች (አጠቃላይ መመሪያ)' },
  completeDeliveriesFootnote: { en: 'Complete {n}+ deliveries to see your own pattern instead of this general guide.', am: '{n}+ ማድረሻዎችን ካጠናቀቁ በኋላ ከዚህ አጠቃላይ መመሪያ ይልቅ የራስዎን ንድፍ ያያሉ።' },
  newOffer:             { en: 'new offer', am: 'አዲስ ትዕዛዝ' },
  stopReceivingOffers:  { en: 'Stop receiving offers?', am: 'ትዕዛዞችን መቀበል ማቆም ይፈልጋሉ?' },
  wontReceiveOffers:    { en: "You won't receive new delivery offers while you're offline.", am: 'ኦፍላይን በሚሆኑበት ጊዜ አዳዲስ የማድረስ ትዕዛዞችን አይቀበሉም።' },
  keepEarning:          { en: 'Keep Earning', am: 'ገቢ መስራት ይቀጥሉ' },
  goOfflineBtn:         { en: 'Go Offline', am: 'ኦፍላይን ሁን' },

  // ─── Active Delivery screen ──────────────────────────────────────────────────
  failedToAcceptOrder:  { en: 'Failed to accept order', am: 'ትዕዛዝ መቀበል አልተሳካም' },
  failedToLoadOrder:    { en: 'Failed to load order', am: 'ትዕዛዝ መጫን አልተሳካም' },
  uploadFailedTitle:    { en: 'Upload failed', am: 'መስቀል አልተሳካም' },
  uploadFailedBody:     { en: 'Could not upload the photo. Please try again.', am: 'ፎቶ መስቀል አልተቻለም። እባክዎ እንደገና ይሞክሩ።' },
  permissionNeededTitle:{ en: 'Permission needed', am: 'ፍቃድ ያስፈልጋል' },
  cameraPermBody:       { en: 'Camera access is required for proof of delivery.', am: 'ለማድረስ ማረጋገጫ የካሜራ ፍቃድ ያስፈልጋል።' },
  libraryPermBody:      { en: 'Photo library access is required for proof of delivery.', am: 'ለማድረስ ማረጋገጫ የፎቶ ቤተ-መጻሕፍት ፍቃድ ያስፈልጋል።' },
  deliveryCompleteTitle:{ en: '🎉 Delivery Complete!', am: '🎉 ማድረስ ተጠናቋል!' },
  deliveryCompleteBody: { en: 'You earned ETB {amount}. Great job!', am: '{amount} ብር አግኝተዋል። ጎበዝ ስራ!' },
  loadingOrder:         { en: 'Loading order...', am: 'ትዕዛዝ እየጫነ ነው...' },
  pickupLocationTitle:  { en: '📦 Pickup Location', am: '📦 የመነሻ አካባቢ' },
  deliveryLocationTitle:{ en: '🏠 Delivery Location', am: '🏠 የመድረሻ አካባቢ' },
  pickedUpFromTemplate: { en: 'Picked up from {name}', am: '{name} ላይ ተነስቷል' },
  cargoDetailsTitle:    { en: '📋 Cargo Details', am: '📋 የጭነት ዝርዝር' },
  podTitle:             { en: '📸 Photo Proof of Delivery', am: '📸 የማድረስ ማረጋገጫ ፎቶ' },
  podSubtitle:          { en: 'Required before completing the delivery', am: 'ማድረሻውን ከማጠናቀቅ በፊት ያስፈልጋል' },
  retakePhoto:          { en: '📷 Retake Photo', am: '📷 እንደገና ፎቶ አንሳ' },
  takePhoto:            { en: '📷 Take Photo', am: '📷 ፎቶ አንሳ' },
  chooseFromLibrary:    { en: 'Or choose from photo library', am: 'ወይም ከፎቶ ቤተ-መጻሕፍት ይምረጡ' },
  confirmArrival:       { en: 'Confirm Arrival', am: 'መድረስ አረጋግጥ' },
  completePickup:       { en: 'Complete Pickup', am: 'መነሳት አጠናቅቅ' },
  navigateToDestination:{ en: 'Navigate to Destination', am: 'ወደ መድረሻ ይምሩ' },
  completeDelivery:     { en: 'Complete Delivery', am: 'ማድረስ አጠናቅቅ' },
  etaAwayTemplate:      { en: '{eta} away', am: '{eta} ይቀራል' },

  // ─── Trips list screen ────────────────────────────────────────────────────────
  filterAll:            { en: 'All', am: 'ሁሉም' },
  filterActive:         { en: 'Active', am: 'ንቁ' },
  filterDelivered:      { en: 'Delivered', am: 'ደርሷል' },
  filterCancelled:      { en: 'Cancelled', am: 'ተሰርዟል' },
  storeFallback:        { en: 'Store', am: 'መደብር' },
  fragileShort:         { en: '⚠️ Fragile', am: '⚠️ ስስ' },
  coldShort:            { en: '❄️ Cold', am: '❄️ ቀዝቃዛ' },
  rateBtn:              { en: '⭐ Rate', am: '⭐ ደረጃ ስጥ' },
  earned:               { en: 'Earned', am: 'ገቢ' },
  noOrdersYet:          { en: 'No orders yet', am: 'ምንም ትዕዛዝ የለም' },
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
 * Translate a key and fill in {placeholder} tokens, e.g.
 * tf('basedOnOrders', language, { n: 42 }) -> "Based on 42 past orders"
 */
export const tf = (key, lang, vars) => {
  let result = t(key, lang);
  for (const [name, value] of Object.entries(vars || {})) {
    result = result.replace(`{${name}}`, value);
  }
  return result;
};

/**
 * Get both translations
 */
export const both = (key) => ({
  en: strings[key]?.en || key,
  am: strings[key]?.am || key,
});

export default strings;
