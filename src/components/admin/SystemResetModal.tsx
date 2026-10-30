import { useState } from 'react';
import { AlertTriangle, Trash2, CheckCircle, XCircle, Loader2, CheckCircle2 as CheckCircle2Icon, FileText as FileTextIcon, Tag as TagIcon, Wrench as WrenchIcon } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { resetSystemForProduction, displayResetReport, type ResetResults } from '../../scripts/resetSystem';

interface SystemResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SystemResetModal({ isOpen, onClose }: SystemResetModalProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [resetResults, setResetResults] = useState<ResetResults | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [step, setStep] = useState<'warning' | 'confirmation' | 'executing' | 'results'>('warning');

  const requiredConfirmation = 'REMETTRE A ZERO';

  const handleClose = () => {
    if (!isResetting) {
      setStep('warning');
      setConfirmationText('');
      setResetResults(null);
      onClose();
    }
  };

  const handleProceedToConfirmation = () => {
    setStep('confirmation');
  };

  const handleExecuteReset = async () => {
    if (confirmationText !== requiredConfirmation || isResetting) {
      return;
    }

    setIsResetting(true);
    setStep('executing');

    try {
      console.log('🚀 Début de la remise à zéro du système...');
      const results = await resetSystemForProduction();
      
      // Afficher le rapport dans la console
      displayResetReport(results);
      
      setResetResults(results);
      setStep('results');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('❌ Erreur lors de la remise à zéro:', error);
      setResetResults({
        deletedCheckouts: 0,
        deletedDeliveryNotes: 0,
        deletedMaintenances: 0,
        deletedInstances: 0,
        updatedEquipment: 0,
        errors: [`Erreur fatale: ${errorMessage}`]
      });
      setStep('results');
    } finally {
      setIsResetting(false);
    }
  };

  const renderWarningStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-danger-600 dark:text-danger-400">
        <AlertTriangle className="w-8 h-8" />
        <h3 className="text-xl font-bold"><AlertTriangle className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Attention - remise à zéro du système</h3>
      </div>

      <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4">
        <h4 className="font-semibold text-danger-800 dark:text-danger-200 mb-3">
          Cette opération supprimera DÉFINITIVEMENT :
        </h4>
        <ul className="list-disc list-inside space-y-2 text-danger-700 dark:text-danger-300">
          <li><Trash2 className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Tous les emprunts en cours et l'historique</li>
          <li><FileTextIcon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Tous les bons de livraison générés</li>
          <li><WrenchIcon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Toutes les maintenances (en cours et passées)</li>
          <li><TagIcon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Toutes les instances d'équipement individuelles</li>
        </ul>
      </div>

      <div className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-4">
        <h4 className="font-semibold text-success-800 dark:text-success-200 mb-3">
          Ce qui sera conservé :
        </h4>
        <ul className="list-disc list-inside space-y-2 text-success-700 dark:text-success-300">
          <li><CheckCircle2Icon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Tous les équipements (remis en "disponible")</li>
          <li><CheckCircle2Icon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Tous les utilisateurs et départements</li>
          <li><CheckCircle2Icon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Toutes les catégories et fournisseurs</li>
          <li><CheckCircle2Icon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Tous les paramètres système</li>
        </ul>
      </div>

      <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
        <p className="text-warning-800 dark:text-warning-200 font-medium">
          <AlertTriangle className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Cette action est IRRÉVERSIBLE ! Assurez-vous d'avoir une sauvegarde si nécessaire.
        </p>
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleClose}>
          Annuler
        </Button>
        <Button variant="danger" onClick={handleProceedToConfirmation}>
          Continuer vers la confirmation
        </Button>
      </div>
    </div>
  );

  const renderConfirmationStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-danger-600 dark:text-danger-400">
        <AlertTriangle className="w-6 h-6" />
        <h3 className="text-lg font-bold">Confirmation finale</h3>
      </div>

      <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4">
        <p className="text-danger-800 dark:text-danger-200 font-medium mb-4">
          Pour confirmer la remise à zéro, tapez exactement le texte suivant :
        </p>
        <p className="font-mono text-lg bg-danger-100 dark:bg-danger-800 p-2 rounded border text-center">
          {requiredConfirmation}
        </p>
      </div>

      <div>
        <input
          type="text"
          value={confirmationText}
          onChange={(e) => setConfirmationText(e.target.value)}
          placeholder="Tapez la confirmation ici..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-danger-500 focus:border-danger-500"
          disabled={isResetting}
        />
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => setStep('warning')}>
          Retour
        </Button>
        <Button 
          variant="danger" 
          onClick={handleExecuteReset}
          disabled={confirmationText !== requiredConfirmation || isResetting}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Remettre à zéro le système
        </Button>
      </div>
    </div>
  );

  const renderExecutingStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-primary-600 dark:text-primary-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <h3 className="text-lg font-bold">Remise à zéro en cours...</h3>
      </div>

      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
        <p className="text-primary-800 dark:text-primary-200">
          La remise à zéro est en cours. Cette opération peut prendre quelques minutes.
          Ne fermez pas cette fenêtre.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="animate-pulse text-primary-600 dark:text-primary-400">
          Suppression des données en cours...
        </div>
      </div>
    </div>
  );

  const renderResultsStep = () => {
    const hasErrors = (resetResults?.errors?.length ?? 0) > 0;
    
    return (
      <div className="space-y-6">
        <div className={`flex items-center gap-3 ${hasErrors ? 'text-danger-600 dark:text-danger-400' : 'text-success-600 dark:text-success-400'}`}>
          {hasErrors ? <XCircle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
          <h3 className="text-lg font-bold">
            {hasErrors ? 'Remise à zéro terminée avec erreurs' : 'Remise à zéro réussie !'}
          </h3>
        </div>

        {resetResults && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Rapport de remise à zéro :</h4>
              <ul className="space-y-2 text-sm">
                <li><Trash2 className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Emprunts supprimés : <strong>{resetResults.deletedCheckouts}</strong></li>
                <li><FileTextIcon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Bons de livraison supprimés : <strong>{resetResults.deletedDeliveryNotes}</strong></li>
                <li><WrenchIcon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Maintenances supprimées : <strong>{resetResults.deletedMaintenances}</strong></li>
                <li><TagIcon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Instances d'équipement supprimées : <strong>{resetResults.deletedInstances}</strong></li>
                <li><CheckCircle2Icon className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Équipements remis en disponible : <strong>{resetResults.updatedEquipment}</strong></li>
              </ul>
            </div>

            {hasErrors && (
              <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4">
                <h4 className="font-semibold text-danger-800 dark:text-danger-200 mb-3">Erreurs rencontrées :</h4>
                <ul className="list-disc list-inside space-y-1 text-danger-700 dark:text-danger-300 text-sm">
                  {resetResults.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleClose}>
            Fermer
          </Button>
        </div>
      </div>
    );
  };

  const getStepContent = () => {
    switch (step) {
      case 'warning':
        return renderWarningStep();
      case 'confirmation':
        return renderConfirmationStep();
      case 'executing':
        return renderExecutingStep();
      case 'results':
        return renderResultsStep();
      default:
        return renderWarningStep();
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      title="Remise à zéro du système"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {getStepContent()}
        </div>
      </div>
    </Modal>
  );
} 