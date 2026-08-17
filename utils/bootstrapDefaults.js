import AdminOperation from '../models/AdminOperation.js';
import Doctor from '../models/Doctor.js';
import Hospital from '../models/Hospital.js';
import Treatment from '../models/Treatment.js';
import { adminSeedRecords } from '../data/adminSeedData.js';
import { clientHospitals } from '../data/clientHospitals.js';
import { encryptJson } from './encryption.js';

const treatmentImages = {
  'Cardiac Sciences': 'https://images.unsplash.com/photo-1628348070889-cb656235b4eb?auto=format&fit=crop&w=900&q=80',
  Orthopedics: 'https://images.unsplash.com/photo-1579684453423-f84349ef60b0?auto=format&fit=crop&w=900&q=80',
  Oncology: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=900&q=80',
  Neurosurgery: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=900&q=80',
  Urology: 'https://images.unsplash.com/photo-1581595219315-a187dd40c322?auto=format&fit=crop&w=900&q=80',
  Gastroenterology: 'https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=900&q=80',
};

const doctorImages = [
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=700&q=80',
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=700&q=80',
  'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=700&q=80',
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=700&q=80',
];

const defaultDoctorNames = ['Dr. Rohan Malhotra', 'Dr. Vikas Bansal', 'Dr. Meera Kapoor', 'Dr. Arjun Nair'];

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function hospitalDefaults() {
  const importedHospitals = clientHospitals.map((hospital, index) => ({
    ...hospital,
    doctor: defaultDoctorNames[index % defaultDoctorNames.length],
    doctorTitle: hospital.doctorTitle || `International Patient Desk - ${hospital.specialty}`,
    doctorImage: doctorImages[index % doctorImages.length],
    summary: `${hospital.name} is listed in the client/JCI hospital master database for ${hospital.specialty} care in ${hospital.city || 'India'}.`,
    galleryImages: Array.isArray(hospital.galleryImages) && hospital.galleryImages.length ? hospital.galleryImages : [hospital.image].filter(Boolean),
    patientReviews: [],
  }));
  return importedHospitals.filter((hospital, index, list) => (
    list.findIndex((item) => item.name.toLowerCase() === hospital.name.toLowerCase() && item.city === hospital.city) === index
  ));
}

export function treatmentDefaults() {
  const byTitle = new Map();

  // Build from surgery seed records — use the actual surgery name as title,
  // and the treatment/category field as group so "Cardiac Sciences" is the
  // category and "Coronary Artery Bypass Grafting (CABG)" is the title.
  adminSeedRecords
    .filter((record) => record.recordType === 'surgery')
    .forEach((record) => {
      const data = record.publicData || {};
      const title = data.surgery || record.title;          // real procedure name
      const group = data.treatment || data.category || title; // clinical category
      if (!byTitle.has(title)) {
        byTitle.set(title, {
          title,
          subtitle: group,
          description: `Plan ${title} in India with verified hospitals, doctors, and backend-managed package estimates.`,
          group,
          specialty: group,
          packageFrom: Number(data.medijourneyPriceInr || data.hospitalCostInr || 0),
          image: treatmentImages[group] || treatmentImages[data.category] || treatmentImages.Orthopedics,
          active: true,
        });
      }
    });
  hospitalDefaults().forEach((hospital) => {
    (hospital.tags || []).forEach((title) => {
      if (!byTitle.has(title)) {
        byTitle.set(title, {
          title,
          subtitle: hospital.specialty || title,
          description: `${title} care mapped from backend NABH hospital catalog for ${hospital.city}.`,
          group: hospital.specialty || title,
          specialty: hospital.specialty || title,
          packageFrom: Number(hospital.packageFrom || 0),
          image: treatmentImages[title] || treatmentImages[hospital.specialty] || treatmentImages.Orthopedics,
          active: true,
        });
      }
    });
  });
  return [...byTitle.values()];
}

export function doctorDefaults(hospitals = hospitalDefaults()) {
  const explicitDoctors = adminSeedRecords
    .filter((record) => record.recordType === 'doctor')
    .map((record, index) => {
      const data = record.publicData || {};
      const hospital = hospitals.find((item) => item.name === data.hospital) || hospitals[index % hospitals.length];
      return {
        name: data.doctorName || record.title,
        title: data.title || `Senior Consultant - ${data.specialty || hospital?.specialty || 'International Care'}`,
        hospital: data.hospital || hospital?.name || '',
        city: hospital?.city || 'New Delhi',
        specialty: data.specialty || hospital?.specialty || '',
        experience: data.experience || '18+ years',
        rating: Number(data.rating || 4.9),
        image: data.profileImage || doctorImages[index % doctorImages.length],
        profileImage: data.profileImage || doctorImages[index % doctorImages.length],
        treatments: splitList(data.treatments).length ? splitList(data.treatments) : hospital?.tags || [],
        focusAreas: hospital?.tags || [],
        education: ['MBBS', 'MS / MD', 'Fellowship in specialty care'],
        about: `${data.doctorName || record.title} supports international patients at ${data.hospital || hospital?.name || 'partner hospitals'}.`,
        active: true,
      };
    });

  const generatedDoctors = hospitals.map((hospital, index) => ({
    name: hospital.doctor || defaultDoctorNames[index % defaultDoctorNames.length],
    title: hospital.doctorTitle || `Senior Consultant - ${hospital.specialty}`,
    hospital: hospital.name,
    city: hospital.city,
    specialty: hospital.specialty,
    experience: `${16 + index}+ years`,
    rating: Number(hospital.rating || 4.8),
    image: hospital.doctorImage || doctorImages[index % doctorImages.length],
    profileImage: hospital.doctorImage || doctorImages[index % doctorImages.length],
    treatments: hospital.tags || [],
    focusAreas: hospital.tags || [],
    education: ['MBBS', 'MS / MD', 'International fellowship'],
    about: `${hospital.doctor || defaultDoctorNames[index % defaultDoctorNames.length]} is mapped to ${hospital.name} for ${hospital.specialty} care.`,
    active: true,
  }));

  return [...explicitDoctors, ...generatedDoctors].filter((doctor, index, list) => (
    list.findIndex((item) => item.name === doctor.name && item.hospital === doctor.hospital) === index
  ));
}

export async function bootstrapDefaults() {
  const adminCount = await AdminOperation.countDocuments();
  if (adminCount === 0) {
    const defaultRecords = [
      ...adminSeedRecords.filter((record) => record.recordType !== 'hospital'),
      ...clientHospitals.map((hospital) => ({
        recordType: 'hospital',
        title: hospital.name,
        status: hospital.certificationStatus || 'Active',
        publicData: hospital,
        confidential: {
          sourceSystem: hospital.sourceSystem,
          importNote: 'Imported from client/JCI hospital master database.',
        },
      })),
      ...doctorDefaults(hospitalDefaults()).map((doctor) => ({
        recordType: 'doctor',
        title: doctor.name,
        status: 'Active',
        publicData: {
          doctorId: doctor.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          doctorName: doctor.name,
          title: doctor.title,
          specialty: doctor.specialty,
          hospital: doctor.hospital,
          experience: doctor.experience,
          rating: doctor.rating,
          profileImage: doctor.profileImage || doctor.image,
          treatments: doctor.treatments,
          focusAreas: doctor.focusAreas,
          education: doctor.education,
          about: doctor.about,
        },
        confidential: { importNote: 'Backend generated doctor catalog record.' },
      })),
    ];

    await AdminOperation.insertMany(defaultRecords.map((record) => ({
      recordType: record.recordType,
      title: record.title,
      status: record.status || 'Active',
      publicData: record.publicData || {},
      encryptedPrivateData: encryptJson(record.confidential || {}),
      createdBy: 'system-default',
    })));
  }

  const hospitals = hospitalDefaults();
  if (await Hospital.countDocuments() === 0) {
    await Hospital.insertMany(hospitals);
  }

  if (await Treatment.countDocuments() === 0) {
    await Treatment.insertMany(treatmentDefaults());
  }

  if (await Doctor.countDocuments() === 0) {
    await Doctor.insertMany(doctorDefaults(hospitals));
  }
}
