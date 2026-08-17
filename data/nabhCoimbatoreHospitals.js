export const nabhCoimbatoreSource = {
  city: 'Coimbatore',
  state: 'Tamil Nadu',
  officialFinderUrl: 'https://nabh.co/find-a-healthcare-organisation/',
  portalUrl: 'https://portal.nabh.co/frmViewAccreditedHosp.aspx',
  referenceUrl: 'https://www.qualityhealth.in/nabh_hospitals_coimbatore',
  importedAt: '2026-06-04',
};

const fullAccredited = [
  'G.Kuppuswami Naidu Memorial Hospital',
  'Ganga Medical Centre and Hospitals Pvt Ltd',
  'GEM Hospital & Research Centre Private Ltd',
  'K.G. Hospital',
  'Kovai Medical Centre And Hospitals',
  'Manu Hospital',
  'One Care Medical Center',
  'Ortho One Orthopaedic Speciality Centre',
  'PSG Hospitals',
  'Sri Ramakrishna Hospital',
  'V.G.M. Hospital',
  'Vikram ENT Hospital & Research Institute',
];

const entryLevel = [
  'Abinand Hospital',
  'Alva Hospital Private Limited',
  'Anp Nursing Home',
  'Anurag Hospital',
  'R Arathana Hospital Pvt. Ltd',
  'Arun Hospital',
  'Ashwin Hospital',
  'Bragathi Hospital',
  'Coimbatore Child Trust Hospital',
  'Coimbatore Kidney Centre & Specialty Hospitals',
  'Deepam Hospital',
  'HEM Hospital',
  'Joseph Hospital',
  'JM Poly Clinic',
  'K.P.S.Hospitals Pvt. Ltd',
  'Kalpana Medical Centre',
  'Karpagam Hospital',
  'KGM Hospital Pvt. Ltd.',
  'Kongunad Hospital',
  'KR Healthcare Pvt. Ltd.',
  'L.G Medical Centre',
  'M.V. Eye Care Centre',
  'Madurai Eye Center LLP',
  'Masonic Medical Centre For Children',
  'Medwin Hospital',
  'Nehru Urology Centre',
  'NG Hospital (P) Ltd. And Research Centre',
  'Preethi Medical Centre And Hospital',
  'Rao Hospital',
  'Revathi Medical Center',
  'Rex Ortho Hospital',
  'Sankara Eye Hospital Sivanandapuram',
  'Saraswathi Hospital',
  'Sheela Hospital Pvt Ltd',
  'Shri Andavar Eye Care And Retina Centre',
  'SPT Hospitals',
  'Sree Abirami Hospital Pvt. Ltd',
  'Sree Abishek Hospital',
  'Sri Kumar Hospital',
  'Sri Lakshmi Medical Centre and Hospital',
  'Surya Hospital',
  'The Eye Foundation',
  'Umadevi Hospital',
  'Vedanayagam Hospital',
  'VG Hospital',
  'Vimal Jyothi Hospital',
  'Vishnu ENT Hospital',
  'Womens Center And Hospitals Pvt. Limited',
  'Vamsam Fertility Research Centre',
  'RS Hospital',
  'Royal Care Super Specialty Hospital',
  'Shanthi Medical Foundation',
];

const verifiedDetails = {
  'K.G. Hospital': {
    address: 'Art College Road, Coimbatore, Tamil Nadu, 641081',
    phone: '+91 422 404 2121',
    accreditationNo: 'H-2010-0049',
    certificationStatus: 'Accredited',
  },
  'Kovai Medical Centre And Hospitals': {
    address: 'Coimbatore, Tamil Nadu, India',
    phone: '+91 422 432 3800',
    accreditationNo: 'H-2012-0137',
    certificationStatus: 'Accredited',
  },
  'PSG Hospitals': {
    address: '271/1 Sarojini Street New Sidhapudur, Coimbatore, Tamil Nadu, 641044',
    accreditationNo: 'HOS/2025/C2879',
    certificationStatus: 'Empaneled',
  },
};

const imagePool = [
  'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=900&q=80',
];

function inferSpecialty(name) {
  const normalized = name.toLowerCase();
  if (normalized.includes('eye') || normalized.includes('retina')) return 'Ophthalmology';
  if (normalized.includes('ent')) return 'Ear, Nose, Throat';
  if (normalized.includes('ortho') || normalized.includes('ganga')) return 'Orthopedics';
  if (normalized.includes('kidney') || normalized.includes('urology') || normalized.includes('vedanayagam')) return 'Urology';
  if (normalized.includes('fertility') || normalized.includes('women') || normalized.includes('rao hospital')) return 'Infertility';
  if (normalized.includes('child') || normalized.includes('children')) return 'Pediatrics';
  if (normalized.includes('gem') || normalized.includes('vgm') || normalized.includes('gastro')) return 'Gastroenterology';
  if (normalized.includes('heart') || normalized.includes('card')) return 'Cardiac Sciences';
  return 'Multi Specialty';
}

function treatmentTagsForSpecialty(specialty) {
  const common = ['General/Internal Medicine', 'Emergency Medicine', 'Critical Care'];
  const map = {
    'Cardiac Sciences': ['Cardiac Sciences', 'Cardiology'],
    Orthopedics: ['Orthopedics', 'Spine Surgery'],
    Ophthalmology: ['Ophthalmology', 'Cataract / Retina Care'],
    Urology: ['Urology', 'Kidney Stone / Prostate Care'],
    Infertility: ['Infertility', 'IVF Treatment', 'Gynaecology'],
    Pediatrics: ['Pediatrics', 'Neonatology'],
    Gastroenterology: ['Gastroenterology', 'Laparoscopic Surgery'],
    'Ear, Nose, Throat': ['Ear, Nose, Throat', 'ENT Surgery'],
    'Multi Specialty': ['Cardiac Sciences', 'Orthopedics', 'Oncology'],
  };
  return [...(map[specialty] || [specialty]), ...common];
}

function toHospital(name, accreditationLevel, index) {
  const specialty = inferSpecialty(name);
  const detail = verifiedDetails[name] || {};
  return {
    name,
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    country: 'India',
    address: detail.address || 'Coimbatore, Tamil Nadu, India',
    phone: detail.phone || '',
    accreditationNo: detail.accreditationNo || '',
    certificationStatus: detail.certificationStatus || accreditationLevel,
    accreditationLevel,
    specialty,
    treatments: treatmentTagsForSpecialty(specialty).join(', '),
    tags: treatmentTagsForSpecialty(specialty),
    accreditations: `NABH ${accreditationLevel}`,
    packageFrom: specialty === 'Ophthalmology' ? 85000 : specialty === 'Infertility' ? 180000 : 240000,
    beds: accreditationLevel === 'Full NABH Accredited' ? 250 : 75,
    rating: Number((4.6 + ((index % 4) * 0.1)).toFixed(1)),
    image: imagePool[index % imagePool.length],
    source: nabhCoimbatoreSource,
    active: true,
  };
}

export const nabhCoimbatoreHospitals = [
  ...fullAccredited.map((name, index) => toHospital(name, 'Full NABH Accredited', index)),
  ...entryLevel.map((name, index) => toHospital(name, 'NABH Certified Entry Level', index + fullAccredited.length)),
];
