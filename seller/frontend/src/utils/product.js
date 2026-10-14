export const normalizeProduct = (product) => ({
  ...product,
  id: product.id || product._id || '',
})

export const totalStock = (stock) => Object.values(stock).reduce((sum, count) => sum + count, 0)

// The sizes a new product is stocked in, from its category.
export const sizeOptionsFor = (draft) => draft.category === 'Footwear' || ['Sneakers', 'Sandals', 'Heels', 'Flats'].includes(draft.subcategory)
  ? ['36', '37', '38', '39', '40', '41', '42']
  : draft.category === 'Accessories' || ['Bags', 'Belts', 'Jewellery', 'Scarves'].includes(draft.subcategory)
    ? ['One size']
    : ['XS', 'S', 'M', 'L', 'XL', 'XXL']
