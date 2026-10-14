import { useEffect, useRef, useState } from 'react'
import { ArrowDownRight, ArrowLeft, ArrowRight, Check, CircleHelp, FileCheck2, LogOut, ShieldCheck, ShoppingBag, Store, Upload, Wallet } from 'lucide-react'
import { errorMessage } from '../api/client'
import * as sellerApi from '../api/seller'
import BackendNotice from '../components/BackendNotice'
import { SelectField, TextField } from '../components/FormFields'
import Wordmark from '../components/Wordmark'
import { useSeller } from '../context/SellerContext'
import { onboardingSteps } from '../utils/constants'

const stepTitles = ['Business details', 'People & addresses', 'Bank details', 'Where you sell']
const stepIntros = ['Start with your registered business identity.', 'Add the people and places connected to your store.', 'Add the account where your payouts should land.', 'Tell us how customers find your products today.']

// The four-step seller application. Progress is saved to the API as the seller types.
function OnboardingPage() {
  const { profile, setProfile, setPhase, setBackendNotice, signOut } = useSeller()
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [signatureFile, setSignatureFile] = useState(null)
  const stepPanelRef = useRef(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void sellerApi.saveApplication(profile)
        .then(() => setBackendNotice(''))
        .catch((error) => setBackendNotice(error.message))
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [profile])

  const updateProfile = (event) => {
    const target = event.currentTarget
    const rawValue = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value
    const value = typeof rawValue === 'string' && ['gstin', 'ifsc'].includes(target.name) ? rawValue.toUpperCase() : rawValue
    setProfile((current) => ({ ...current, [target.name]: value }))
  }

  const field = (name, label, type = 'text', placeholder = '', extra = {}) => (
    <TextField
      label={label}
      name={name}
      type={type}
      placeholder={placeholder}
      value={String(profile[name] ?? '')}
      onChange={updateProfile}
      required
      {...extra}
    />
  )

  const select = (name, label, options) => (
    <SelectField label={label} name={name} value={String(profile[name] ?? '')} onChange={updateProfile} required>
      <option value="" disabled>Select {label.toLowerCase()}</option>
      {options.map((option) => <option key={option}>{option}</option>)}
    </SelectField>
  )

  const uploadSignature = async (file) => {
    setSignatureFile(file)
    try {
      const result = await sellerApi.uploadSignature(file)
      setProfile((current) => ({ ...current, signature: result.signature }))
      setBackendNotice('')
    } catch (error) {
      setBackendNotice(errorMessage(error, 'Could not upload the signature image.'))
    }
  }

  const advanceOnboarding = async () => {
    const invalid = stepPanelRef.current?.querySelector(':invalid')
    if (invalid) {
      invalid.reportValidity()
      return
    }
    try {
      await sellerApi.saveApplication(profile)
      if (onboardingStep < 3) {
        setOnboardingStep((current) => current + 1)
        return
      }
      await sellerApi.submitApplication()
      setBackendNotice('')
      setPhase('pending')
    } catch (error) {
      setBackendNotice(errorMessage(error, 'Could not save your application.'))
    }
  }

  const progress = ((onboardingStep + 1) / onboardingSteps.length) * 100

  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <Wordmark />
        <div className="onboarding-header-right"><span><ShieldCheck size={15} /> ENCRYPTED APPLICATION</span><button className="text-button" type="button" onClick={signOut}><LogOut size={15} /> Sign out</button></div>
      </header>
      <div className="onboarding-layout">
        <aside className="onboarding-aside">
          <span className="eyebrow">SELLER APPLICATION&nbsp; / &nbsp;01</span>
          <h1>Let’s get to<br />know your <em>label.</em></h1>
          <p>Tell us a little about your business. This information helps us set up your seller account and verify your store.</p>
          <div className="step-list">
            {onboardingSteps.map((item, index) => <div className={`step-list-item ${index === onboardingStep ? 'active' : ''} ${index < onboardingStep ? 'complete' : ''}`} key={item}><span className="step-list-number">{index < onboardingStep ? <Check size={14} /> : `0${index + 1}`}</span><span>{item}</span><span className="step-list-state">{index < onboardingStep ? 'DONE' : index === onboardingStep ? 'IN PROGRESS' : ''}</span></div>)}
          </div>
          <div className="aside-help"><CircleHelp size={17} /><span>Questions about seller setup?<br /><a href="mailto:sellers@threadline.example">Talk to seller support</a></span></div>
        </aside>

        <section className="onboarding-content" id="top">
          <div className="onboarding-progress"><span>APPLICATION PROGRESS</span><strong>{Math.round(progress)}%</strong><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>
          <div className="form-heading"><span className="eyebrow">STEP 0{onboardingStep + 1} OF 04</span><h2>{stepTitles[onboardingStep]}</h2><p>{stepIntros[onboardingStep]}</p></div>

          <div className="form-panel" ref={stepPanelRef}>
            {onboardingStep === 0 && <div className="field-grid">
              <div className="field-grid-full">{field('gstin', 'GSTIN', 'text', '22AAAAA0000A1Z5', { pattern: '[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]', title: 'Enter a valid 15-character GSTIN', maxLength: 15, style: { textTransform: 'uppercase' } })}</div>
              <div className="field-grid-full">{field('businessName', 'Registered business name', 'text', 'As shown on your GST certificate')}</div>
              <div className="field-grid-full"><div className="section-divider"><span>PRIMARY CONTACT</span><span>Who we’ll reach out to</span></div></div>
              {field('primaryName', 'Full name', 'text', 'Contact person')}
              {field('primaryEmail', 'Email address', 'email', 'name@business.com')}
              {field('primaryPhone', 'Phone number', 'tel', '10-digit mobile number', { pattern: '[6-9][0-9]{9}' })}
            </div>}

            {onboardingStep === 1 && <div className="field-grid">
              <div className="field-grid-full"><label className="check-row"><input name="sameOwner" type="checkbox" checked={Boolean(profile.sameOwner)} onChange={updateProfile} /><span className="custom-check"><Check size={13} /></span><span><strong>Business owner is the primary contact</strong><small>Use the contact details already provided</small></span></label></div>
              {!profile.sameOwner && <>
                <div className="field-grid-full"><div className="section-divider"><span>BUSINESS OWNER</span><span>Legal account holder</span></div></div>
                {field('ownerName', 'Owner full name', 'text', 'Name as shown on ID')}
                {field('ownerEmail', 'Owner email', 'email', 'owner@business.com')}
                {field('ownerPhone', 'Owner phone number', 'tel', '10-digit mobile number', { pattern: '[6-9][0-9]{9}' })}
              </>}
              <div className="field-grid-full"><div className="section-divider"><span>SELLER ADDRESS</span><span>Registered business address</span></div></div>
              <label className="field field-grid-full"><span>Street address</span><textarea className="control textarea" name="sellerAddress" value={String(profile.sellerAddress)} onChange={updateProfile} placeholder="Building, street, area" required /></label>
              {field('sellerCity', 'City', 'text', 'City')}{field('sellerState', 'State', 'text', 'State')}{field('sellerPincode', 'PIN code', 'text', '6-digit PIN', { pattern: '[0-9]{6}', maxLength: 6 })}
              <div className="field-grid-full"><div className="section-divider"><span>WAREHOUSE ADDRESS</span><span>Where your inventory ships from</span></div></div>
              <div className="field-grid-full"><label className="check-row"><input name="sameWarehouse" type="checkbox" checked={Boolean(profile.sameWarehouse)} onChange={updateProfile} /><span className="custom-check"><Check size={13} /></span><span><strong>Same as seller address</strong><small>Use your registered address as the dispatch location</small></span></label></div>
              {!profile.sameWarehouse && <>
                <label className="field field-grid-full"><span>Warehouse street address</span><textarea className="control textarea" name="warehouseAddress" value={String(profile.warehouseAddress)} onChange={updateProfile} placeholder="Building, street, area" required /></label>
                {field('warehouseCity', 'City', 'text', 'City')}{field('warehouseState', 'State', 'text', 'State')}{field('warehousePincode', 'PIN code', 'text', '6-digit PIN', { pattern: '[0-9]{6}', maxLength: 6 })}
              </>}
              <div className="field-grid-full"><div className="section-divider"><span>BUSINESS OWNER SIGNATURE</span><span>PNG or JPEG · up to 5 MB</span></div><label className={`upload-field ${profile.signature ? 'has-file' : ''}`}><input type="file" accept="image/png,image/jpeg" required={!profile.signature} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void uploadSignature(file) }} /><span className="upload-icon"><Upload size={18} /></span><span><strong>{signatureFile?.name || (profile.signature ? 'Signature uploaded' : 'Upload signature image')}</strong><small>{profile.signature ? 'Click to replace this file' : 'A clear image of the business owner’s signature'}</small></span><ArrowDownRight size={16} /></label></div>
            </div>}

            {onboardingStep === 2 && <div className="field-grid">
              <div className="field-grid-full"><div className="bank-note"><Wallet size={19} /><span><strong>Your payouts, your account.</strong><small>Bank details are used only for seller settlements.</small></span><ShieldCheck size={17} /></div></div>
              <div className="field-grid-full">{field('bankName', 'Bank name', 'text', 'e.g. HDFC Bank')}</div>
              {select('accountType', 'Account type', ['Current', 'Savings'])}
              {field('ifsc', 'IFSC code', 'text', 'e.g. HDFC0001234', { pattern: '[A-Z]{4}0[A-Z0-9]{6}', title: 'Enter a valid 11-character IFSC code', maxLength: 11, style: { textTransform: 'uppercase' } })}
              {field('accountNumber', 'Account number', 'text', 'Enter account number', { minLength: 8, maxLength: 18, pattern: '[0-9]{8,18}' })}
              {field('accountHolder', 'Account holder name', 'text', 'As registered with your bank')}
            </div>}

            {onboardingStep === 3 && <div className="field-grid">
              <div className="field-grid-full"><span className="field-label">How do you currently sell?</span><div className="choice-grid">
                <label className={`choice-card ${profile.sellingMode === 'marketplace' ? 'selected' : ''}`}><input type="radio" name="sellingMode" value="marketplace" checked={profile.sellingMode === 'marketplace'} onChange={updateProfile} required /><span className="choice-icon"><ShoppingBag size={19} /></span><strong>On a marketplace</strong><small>I sell through another shopping platform</small></label>
                <label className={`choice-card ${profile.sellingMode === 'independent' ? 'selected' : ''}`}><input type="radio" name="sellingMode" value="independent" checked={profile.sellingMode === 'independent'} onChange={updateProfile} required /><span className="choice-icon"><Store size={19} /></span><strong>Independently</strong><small>I sell through my own website</small></label>
              </div></div>
              {profile.sellingMode === 'marketplace' ? <>
                {field('marketplaceName', 'Marketplace name', 'text', 'e.g. Amazon, Ajio')}
                {field('marketplaceRating', 'Current seller rating', 'number', 'e.g. 4.5', { min: 0, max: 5, step: 0.1 })}
              </> : <div className="field-grid-full">{field('websiteUrl', 'Website URL', 'url', 'https://yourbrand.com')}</div>}
              <div className="field-grid-full"><div className="review-summary"><FileCheck2 size={19} /><span><strong>Ready for a final review?</strong><small>Our team usually reviews complete applications within 2–3 business days.</small></span></div></div>
            </div>}
          </div>

          <div className="form-actions">
            {onboardingStep > 0 ? <button className="button button-quiet" type="button" onClick={() => setOnboardingStep((current) => current - 1)}><ArrowLeft size={16} /> Back</button> : <span className="save-note"><ShieldCheck size={14} /> Your progress saves automatically</span>}
            <button className="button button-primary" type="button" onClick={advanceOnboarding}>{onboardingStep === 3 ? 'Submit application' : 'Save & continue'}<ArrowRight size={16} /></button>
          </div>
          <BackendNotice />
          <p className="prototype-note">Your seller information is saved securely to your account as you continue.</p>
        </section>
      </div>
    </main>
  )
}

export default OnboardingPage
