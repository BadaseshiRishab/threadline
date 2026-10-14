// Shared by delivery jobs (deliveries.js) and return jobs (returns.js).

// Delivery orders a partner is still working on.
export const openStatuses = ['placed', 'packed', 'shipped', 'out_for_delivery']

// Seller details a delivery partner needs: where to collect from (or return to) and whom to call.

export const sellerFields = 'email phone application.businessName application.primaryPhone application.sameWarehouse application.sellerAddress application.sellerCity application.sellerState application.sellerPincode application.warehouseAddress application.warehouseCity application.warehouseState application.warehousePincode'

// Where the partner collects each seller's items. Only the business name, contact number and pickup address are
// taken from the seller application; bank details and the rest never leave the database.
export const pickupFor = (seller) => {
  const application = seller?.application || {}
  const warehouse = application.sameWarehouse !== true && String(application.warehouseAddress || '').trim()
  const [line, city, state, pincode] = warehouse
    ? [application.warehouseAddress, application.warehouseCity, application.warehouseState, application.warehousePincode]
    : [application.sellerAddress, application.sellerCity, application.sellerState, application.sellerPincode]
  return { sellerId: String(seller?._id || seller || ''), name: application.businessName || seller?.email || 'Seller', phone: application.primaryPhone || seller?.phone || '', line: line || '', city: city || '', state: state || '', pincode: pincode || '' }
}
