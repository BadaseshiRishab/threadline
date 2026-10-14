import { ArrowLeft, Boxes, Clock3, FileCheck2, ImagePlus, ShieldCheck, ShoppingBag } from 'lucide-react'
import { errorMessage } from '../api/client'
import * as sellerApi from '../api/seller'
import { SelectField, TextField } from '../components/FormFields'
import { useSeller } from '../context/SellerContext'
import { emptyProduct, productCategories } from '../utils/constants'
import { normalizeProduct, sizeOptionsFor } from '../utils/product'

// A new product for admin to review. The draft lives in DashboardPage so it survives switching tabs.
function AddProductPage({ productDraft, setProductDraft, setDashboardTab }) {
  const { setProducts, setBackendNotice } = useSeller()
  const sizeOptions = sizeOptionsFor(productDraft)
  const updateProduct = (name, value) => setProductDraft((current) => ({ ...current, [name]: value }))

  const submitProduct = async (event) => {
    event.preventDefault()
    try {
      const product = await sellerApi.createProduct({
        ...productDraft,
        cost: Number(productDraft.cost),
        stock: Object.fromEntries(Object.entries(productDraft.stock).map(([size, count]) => [size, Number(count || 0)])),
      })
      setProducts((current) => [normalizeProduct(product), ...current])
      setProductDraft(emptyProduct)
      setDashboardTab('overview')
    } catch (error) {
      setBackendNotice(errorMessage(error, 'Could not submit this product.'))
    }
  }

  return <div className="dashboard-page add-product-page">
    <button className="back-link" type="button" onClick={() => setDashboardTab('products')}><ArrowLeft size={15} /> Back to products</button>
    <div className="dashboard-heading add-product-heading"><div><span className="eyebrow">PRODUCT SUBMISSION</span><h1>Add a product</h1><p>Product details are reviewed before they go live in your store.</p></div><span className="draft-status"><span /> DRAFT</span></div>
    <form className="product-form-layout" onSubmit={submitProduct}>
      <div className="product-form-main">
        <section className="product-form-card"><div className="product-form-card-heading"><span className="form-icon"><ShoppingBag size={17} /></span><div><h2>Product details</h2><p>Give your product a name customers will remember.</p></div></div><div className="field-grid">
          <TextField label="Product name" placeholder="e.g. The Sunday Linen Shirt" value={productDraft.name} onChange={(event) => updateProduct('name', event.target.value)} required />
          <TextField label="Tagline" placeholder="A short line with a point of view" value={productDraft.tagline} onChange={(event) => updateProduct('tagline', event.target.value)} required />
          <SelectField label="Category" value={productDraft.category} onChange={(event) => { const category = event.target.value; setProductDraft((current) => ({ ...current, category, subcategory: productCategories[category][0], stock: {} })) }} required>{Object.keys(productCategories).map((category) => <option key={category}>{category}</option>)}</SelectField>
          <SelectField label="Subcategory" value={productDraft.subcategory} onChange={(event) => setProductDraft((current) => ({ ...current, subcategory: event.target.value, stock: {} }))} required>{productCategories[productDraft.category].map((subcategory) => <option key={subcategory}>{subcategory}</option>)}</SelectField>
          <TextField label="Actual product price (₹)" type="number" min="1" step="1" placeholder="0.00" value={productDraft.cost} onChange={(event) => updateProduct('cost', event.target.value)} required />
          <div className="field field-description"><label htmlFor="product-description">Product description</label><textarea id="product-description" className="control textarea" placeholder="Fabric, fit, care details and anything else customers should know..." value={productDraft.description} onChange={(event) => updateProduct('description', event.target.value)} minLength={20} required /></div>
        </div></section>
        <section className="product-form-card"><div className="product-form-card-heading"><span className="form-icon"><Boxes size={17} /></span><div><h2>Available stock</h2><p>Enter stock for each size in this subcategory.</p></div><span className="size-type">{productDraft.category === 'Footwear' ? 'FOOTWEAR SIZES' : productDraft.category === 'Accessories' ? 'ONE SIZE' : 'APPAREL SIZES'}</span></div>
          <div className="stock-grid">{sizeOptions.map((size) => <label className="stock-field" key={size}><span>{size}</span><input aria-label={`${size} stock`} type="number" min="0" step="1" placeholder="0" value={productDraft.stock[size] ?? ''} onChange={(event) => setProductDraft((current) => ({ ...current, stock: { ...current.stock, [size]: event.target.value } }))} required /></label>)}</div>
          <div className="stock-total"><span>Total units available</span><strong>{Object.values(productDraft.stock).reduce((sum, count) => sum + Number(count || 0), 0)}</strong></div>
        </section>
        <div className="product-submit-row"><span><ShieldCheck size={15} /> You can edit details before approval.</span><button className="button button-primary" type="submit"><FileCheck2 size={16} /> Submit for approval</button></div>
      </div>
      <aside className="product-form-side">
        <div className="product-form-card image-card"><div className="product-form-card-heading"><span className="form-icon"><ImagePlus size={17} /></span><div><h2>Product image</h2><p>Paste a public image URL.</p></div></div><TextField label="Image URL" type="url" placeholder="https://..." value={productDraft.imageUrl} onChange={(event) => updateProduct('imageUrl', event.target.value)} required />{productDraft.imageUrl ? <img className="image-preview" src={productDraft.imageUrl} alt="Product preview" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <div className="image-placeholder"><ImagePlus size={24} /><span>IMAGE PREVIEW</span></div>}</div>
        <div className="submission-note"><Clock3 size={16} /><span><strong>What happens next?</strong><small>Our catalog team reviews your submission. Once approved, the product appears in your live products page.</small></span></div>
      </aside>
    </form>
  </div>
}

export default AddProductPage
