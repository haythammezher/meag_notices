import AppLayout from '@/components/AppLayout';
import SafetyFlashContent from './components/SafetyFlashContent';

export default function SafetyFlashPage() {
  return (
    <AppLayout pageTitle="Safety Flash" pageSubtitle="Emergency broadcast — immediate multi-channel alert distribution">
      <SafetyFlashContent />
    </AppLayout>
  );
}
