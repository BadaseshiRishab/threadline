// The single source of truth for Threadline's MongoDB schemas, used by the seller, admin and customer APIs.
// Each backend has its own mongoose install, so this file takes that instance and registers the models on it
// (see each backend's src/models/index.js). Do not import 'mongoose' here.
//
// Collections and the links between them:
//   sellers          seller accounts and their (encrypted) seller application
//   customers        customer accounts, profile, addresses, cart and wishlist
//   admins           admin accounts
//   deliverypartners delivery partner accounts; partners apply, admin approves
//   products         seller        → sellers,   reviewedBy  → admins
//   orders           customer      → customers, items.seller → sellers, items.product → products,
//                    deliveryPartner → deliverypartners
//   reservations     customer      → customers, product      → products
//   restockrequests  seller        → sellers,   requestedBy  → admins, product → products
//   verifications    one-time email/SMS codes for sign-up and login (expire automatically)

// Catalog sources shown to customers and counted in admin reports.
export const listedSourceProviders = ['dummyjson', 'seller', 'threadline-catalog']

// Every account type answers `role` the same way the old shared users collection did, without storing it.
const fixedRole = (schema, role) => schema.virtual('role').get(() => role)

export function defineModels(mongoose) {
  const { Schema } = mongoose
  const { ObjectId, Mixed } = Schema.Types
  const model = (name, schema, collection) => mongoose.models[name] ?? mongoose.model(name, schema, collection)

  const sellerSchema = new Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, match: /^[6-9]\d{9}$/ },
    passwordHash: { type: String, required: true, select: false },
    emailVerifiedAt: { type: Date, default: null },
    phoneVerifiedAt: { type: Date, default: null },
    sellerStatus: { type: String, enum: ['draft', 'pending', 'approved', 'rejected'], default: 'draft', index: true },
    application: { type: Mixed, default: {} },
  }, { timestamps: true })
  fixedRole(sellerSchema, 'seller')

  const customerSchema = new Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, match: /^[6-9]\d{9}$/ },
    passwordHash: { type: String, required: true, select: false },
    customerProfile: { type: Mixed, default: {} },
    addresses: { type: Mixed, default: [] },
    cart: { type: Mixed, default: [] },
    wishlist: { type: Mixed, default: [] },
    failedLoginAttempts: { type: Number, default: 0 },
    loginLockLevel: { type: Number, default: 0 },
    loginLockedUntil: { type: Date, default: null },
  }, { timestamps: true })
  fixedRole(customerSchema, 'customer')

  const adminSchema = new Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  }, { timestamps: true })
  fixedRole(adminSchema, 'admin')

  // People apply from the delivery app; once admin approves the application they can accept orders to deliver.
  const deliveryPartnerSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, match: /^[6-9]\d{9}$/ },
    passwordHash: { type: String, required: true, select: false },
    vehicleType: { type: String, enum: ['Bike', 'Scooter', 'Bicycle', 'Van'], default: 'Bike' },
    vehicleNumber: { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
    area: { type: String, trim: true, maxlength: 80, default: '' },
    // Driving licence, required for motor vehicles; admin checks it before approving.
    licenceNumber: { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
    // Scans of the driving licence and vehicle registration certificate (RC), stored by file name in private_uploads.
    licenceDoc: { type: String, default: '' },
    rcDoc: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewNote: { type: String, trim: true, maxlength: 300, default: '' },
    reviewedAt: { type: Date, default: null },
    appliedAt: { type: Date, default: Date.now },
    // Admin can deactivate an approved partner: they cannot sign in or take orders; past deliveries are kept.
    active: { type: Boolean, default: true, index: true },
  }, { timestamps: true })
  fixedRole(deliveryPartnerSchema, 'delivery')

  const productSchema = new Schema({
    seller: { type: ObjectId, ref: 'Seller', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    tagline: { type: String, required: true, trim: true, maxlength: 180 },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    subcategory: { type: String, required: true, trim: true, maxlength: 80 },
    cost: { type: Number, required: true, min: 1 },
    marginPercent: { type: Number, default: 0, min: 0, max: 100 },
    marginAmount: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: null, min: 0 },
    salePercent: { type: Number, default: 0, min: 0, max: 100 },
    reviews: { type: Mixed, default: [] },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    catalogData: { type: Mixed, default: {} },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    imageUrl: { type: String, required: true, trim: true },
    stock: { type: Mixed, required: true, default: {} },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: ObjectId, ref: 'Admin', default: null },
    sourceProvider: { type: String, default: 'seller' },
    sourceId: { type: String, default: null },
  }, { timestamps: true, toJSON: { flattenMaps: true } })
  // Imported catalogs are matched on (sourceProvider, sourceId); seller-created products have no sourceId.
  productSchema.index({ sourceProvider: 1, sourceId: 1 }, { unique: true, partialFilterExpression: { sourceId: { $type: 'string' } } })
  productSchema.index({ status: 1, sourceProvider: 1, category: 1 })

  // A customer's request to return one delivered order item, resolved by that item's seller.
  const returnRequestSchema = new Schema({
    status: { type: String, enum: ['requested', 'approved', 'rejected'], required: true },
    reason: { type: String, required: true, maxlength: 80 },
    message: { type: String, required: true, maxlength: 500 },
    sellerMessage: { type: String, maxlength: 500, default: '' },
    requestedAt: { type: Date, required: true },
    resolvedAt: Date,
    restockedQuantity: { type: Number, default: 0 },
  }, { _id: false })

  const orderItemSchema = new Schema({
    product: { type: ObjectId, ref: 'Product', required: true },
    seller: { type: ObjectId, ref: 'Seller', required: true },
    // Snapshot of the product at order time, so orders and reports survive later product edits or deletion.
    name: { type: String, required: true },
    category: String,
    subcategory: String,
    imageUrl: String,
    size: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    returnRequest: returnRequestSchema,
  })

  const orderSchema = new Schema({
    customer: { type: ObjectId, ref: 'Customer', required: true, index: true },
    items: { type: [orderItemSchema], validate: [(items) => items.length > 0, 'An order needs at least one item.'] },
    shippingAddress: { type: Mixed, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    gstPercent: { type: Number, default: 18, min: 0 },
    gstAmount: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, enum: ['cod', 'razorpay', 'upi'], default: 'cod' },
    // pending: COD not yet collected, or online payment not yet made. awaiting_verification: the customer
    // submitted a UPI transaction reference that admin still has to match against the bank statement.
    paymentStatus: { type: String, enum: ['pending', 'awaiting_verification', 'paid', 'failed'], default: 'pending' },
    paidAt: Date,
    razorpayOrderId: { type: String, index: { sparse: true } },
    razorpayPaymentId: String,
    upiTransactionId: { type: String, unique: true, sparse: true },
    // pending_payment orders hold stock while the customer pays online; sellers and admin never see them.
    status: { type: String, enum: ['pending_payment', 'placed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'], default: 'placed', index: true },
    deliveredAt: Date,
    // Shown only to the customer; the seller must enter it to mark the order delivered.
    deliveryOtp: String,
    deliveryOtpAttempts: { type: Number, default: 0 },
    // Once admin assigns a partner, the partner (not the seller) moves the order from pickup to delivery.
    deliveryPartner: { type: ObjectId, ref: 'DeliveryPartner', default: null, index: true },
    deliveryAssignedAt: Date,
    // One handover per seller in the order, created when a partner takes the order. The seller reads the 4-digit
    // code to the partner, who enters it to confirm they collected that seller's items; the order counts as
    // picked up (status "shipped") once every seller has handed over.
    pickupHandovers: { type: [new Schema({
      seller: { type: ObjectId, ref: 'Seller', required: true },
      otp: { type: String, required: true },
      attempts: { type: Number, default: 0 },
      pickedUpAt: { type: Date, default: null },
    }, { _id: false })], default: undefined },
    // Accepted returns travel back to the seller with a delivery partner: one pickup per seller, holding the items of
    // theirs the customer is returning. The customer reads customerOtp to the partner when handing the items over,
    // and the seller reads sellerOtp when receiving them; the items go back into stock then.
    returnPickups: { type: [new Schema({
      seller: { type: ObjectId, ref: 'Seller', required: true },
      items: [{ type: ObjectId }],
      status: { type: String, enum: ['awaiting_partner', 'assigned', 'picked_up', 'returned'], default: 'awaiting_partner' },
      deliveryPartner: { type: ObjectId, ref: 'DeliveryPartner', default: null },
      customerOtp: { type: String, required: true },
      customerOtpAttempts: { type: Number, default: 0 },
      sellerOtp: { type: String, required: true },
      sellerOtpAttempts: { type: Number, default: 0 },
      requestedAt: { type: Date, default: Date.now },
      assignedAt: Date,
      pickedUpAt: Date,
      returnedAt: Date,
    })], default: undefined },
  }, { timestamps: true })
  orderSchema.index({ 'returnPickups.status': 1 }, { sparse: true })
  orderSchema.index({ 'returnPickups.deliveryPartner': 1 }, { sparse: true })
  orderSchema.index({ 'items.seller': 1, createdAt: -1 })
  orderSchema.index({ createdAt: -1 })

  const reservationSchema = new Schema({
    customer: { type: ObjectId, ref: 'Customer', required: true, index: true },
    product: { type: ObjectId, ref: 'Product', required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    size: { type: String, default: '' },
    expiresAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['active', 'converted', 'released'], default: 'active', index: true },
  }, { timestamps: true })

  const restockRequestSchema = new Schema({
    product: { type: ObjectId, ref: 'Product', required: true, index: true },
    seller: { type: ObjectId, ref: 'Seller', required: true, index: true },
    requestedBy: { type: ObjectId, ref: 'Admin', required: true },
    status: { type: String, enum: ['open', 'fulfilled', 'cancelled'], default: 'open', index: true },
    // Units per size admin asks for, e.g. { M: 10, L: 5 }; addedStock is what the seller actually added.
    requestedStock: { type: Mixed, default: {} },
    addedStock: { type: Mixed, default: {} },
    fulfilledAt: { type: Date, default: null },
  }, { timestamps: true, toJSON: { flattenMaps: true } })

  // One-time codes. purpose keeps them apart: seller sign-up, customer and partner sign-up and login.
  const verificationSchema = new Schema({
    purpose: { type: String, default: 'seller-signup' },
    channel: { type: String, enum: ['email', 'phone'], required: true },
    address: { type: String, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    verifiedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
  }, { timestamps: true })
  verificationSchema.index({ purpose: 1, channel: 1, address: 1 }, { unique: true })

  return {
    Seller: model('Seller', sellerSchema, 'sellers'),
    Customer: model('Customer', customerSchema, 'customers'),
    Admin: model('Admin', adminSchema, 'admins'),
    Product: model('Product', productSchema, 'products'),
    Order: model('Order', orderSchema, 'orders'),
    Reservation: model('Reservation', reservationSchema, 'reservations'),
    RestockRequest: model('RestockRequest', restockRequestSchema, 'restockrequests'),
    Verification: model('Verification', verificationSchema, 'verifications'),
    DeliveryPartner: model('DeliveryPartner', deliveryPartnerSchema, 'deliverypartners'),
  }
}
