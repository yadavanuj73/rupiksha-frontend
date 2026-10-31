import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
    IndianRupee, Save, RotateCcw, ShieldAlert, CheckCircle2,
    AlertTriangle, Search, Filter, History, ChevronLeft, ChevronRight,
    RefreshCw, Layers, Sparkles, TrendingUp, HelpCircle, HandCoins,
    Percent, ToggleLeft, ToggleRight, Check, X, ShieldCheck, ArrowRight,
    Calculator, Building2, Coins, ArrowUpRight, Smartphone, Tv, Radio, Signal
} from 'lucide-react';
import { ChevronDown, ArrowLeft } from 'lucide-react';
import { commissionService } from '../../services/commissionService';
import { BBPS_CATEGORIES } from '../../retailer/data/bbpsCategories';

export default function CommissionManagement() {
    // ── MODEL SWITCHER: 'AEPS_1', 'BBPS' or 'RECHARGE'
    const [commissionModel, setCommissionModel] = useState('AEPS_1'); // 'AEPS_1' | 'BBPS' | 'RECHARGE'
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const modelDropdownRef = React.useRef(null);

    // ── BBPS STEP FLOW: 'select-service' or 'configure'
    const [bbpsStep, setBbpsStep] = useState('select-service');

    const COMMISSION_MODELS = [
        {
            id: 'AEPS_1',
            label: 'AEPS 1',
            sublabel: 'Fixed Slabs',
            description: 'Cash Withdrawal & Biometric Banking',
            badge: 'Slab Based',
            icon: Layers,
            accent: 'indigo'
        },
        {
            id: 'BBPS',
            label: 'BBPS',
            sublabel: 'Percentage %',
            description: 'Bharat Connect Bill Payment System',
            badge: 'Percentage',
            icon: Percent,
            accent: 'emerald'
        },
        {
            id: 'RECHARGE',
            label: 'Mobile & DTH Recharge',
            sublabel: 'Percentage / Fixed ₹',
            description: 'Prepaid Mobile & DTH Recharge Commission Strategy',
            badge: 'Flexible ₹/%',
            icon: Smartphone,
            accent: 'blue'
        }
    ];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target)) {
                setIsModelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleModelChange = (modelId) => {
        if (modelId === commissionModel) return;
        setCommissionModel(modelId);
        setNotification(null);
        if (modelId === 'BBPS') {
            setBbpsStep('select-service');
        } else if (modelId === 'RECHARGE') {
            setRechargeStep('select-operator');
            fetchRechargeOperators(rechargeCategory);
        }
    };

    const handleSelectBbpsService = (serviceId) => {
        setSelectedBbpsServiceId(serviceId);
        setBbpsStep('configure');
        setBbpsSearch('');
        setNotification(null);
    };

    // ── AEPS 1 STATE ────────────────────────────────────────────────────────────
    const [services] = useState([
        { id: 'AEPS_1', label: 'AEPS 1 (Cash Withdrawal)' }
    ]);
    const [selectedService, setSelectedService] = useState('AEPS_1');
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [slabs, setSlabs] = useState([]);
    const [originalSlabs, setOriginalSlabs] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(true);

    // ── BBPS STATE ──────────────────────────────────────────────────────────────
    const [bbpsSearch, setBbpsSearch] = useState('');
    const [selectedBbpsServiceId, setSelectedBbpsServiceId] = useState('loan-repayment');
    const [bbpsConfigs, setBbpsConfigs] = useState([]);
    const [loadingBbpsConfigs, setLoadingBbpsConfigs] = useState(false);
    const [selectedBbpsPlanCode, setSelectedBbpsPlanCode] = useState('FREE');
    const [bbpsFormData, setBbpsFormData] = useState({
        retailerPercentage: '0.20',
        distributorPercentage: '0.10',
        superDistributorPercentage: '0.05',
        enabled: true
    });
    const [originalBbpsFormData, setOriginalBbpsFormData] = useState(null);
    const [simulatedAmount, setSimulatedAmount] = useState('2000');

    // ── MOBILE & DTH RECHARGE STATE ─────────────────────────────────────────────
    const [rechargeCategory, setRechargeCategory] = useState('MOBILE'); // 'MOBILE' | 'DTH'
    const [rechargeStep, setRechargeStep] = useState('select-operator'); // 'select-operator' | 'configure'
    const [rechargeOperators, setRechargeOperators] = useState([]);
    const [loadingRechargeOperators, setLoadingRechargeOperators] = useState(false);
    const [rechargeSearch, setRechargeSearch] = useState('');
    const [selectedOperatorCode, setSelectedOperatorCode] = useState('JRE');
    const [selectedOperatorName, setSelectedOperatorName] = useState('Jio Recharge');
    const [rechargeConfigs, setRechargeConfigs] = useState([]);
    const [loadingRechargeConfigs, setLoadingRechargeConfigs] = useState(false);
    const [selectedRechargePlanCode, setSelectedRechargePlanCode] = useState('FREE');
    const [rechargeFormData, setRechargeFormData] = useState({
        commissionMode: 'PERCENTAGE',
        retailerValue: '1.00',
        distributorValue: '0.25',
        superDistributorValue: '0.25',
        enabled: true
    });
    const [originalRechargeFormData, setOriginalRechargeFormData] = useState(null);
    const [simulatedRechargeAmount, setSimulatedRechargeAmount] = useState('500');
    const [rechargeAudits, setRechargeAudits] = useState([]);

    // ── COMMON STATE ────────────────────────────────────────────────────────────
    const [saving, setSaving] = useState(false);
    const [reconciling, setReconciling] = useState(false);
    const [notification, setNotification] = useState(null); // { type: 'success' | 'error' | 'info', message: '' }
    const [activeTab, setActiveTab] = useState('config'); // 'config' | 'history'

    // ── HISTORY STATE ───────────────────────────────────────────────────────────
    const [historyList, setHistoryList] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyPage, setHistoryPage] = useState(0);
    const [historySize] = useState(10);
    const [historySearch, setHistorySearch] = useState('');
    const [historyStatus, setHistoryStatus] = useState('ALL');
    const [historyServiceFilter, setHistoryServiceFilter] = useState('ALL');

    // ── 1. FETCH AEPS PLANS & SLABS ─────────────────────────────────────────────
    const fetchAepsPlans = async () => {
        setLoadingPlans(true);
        try {
            const data = await commissionService.getPlans('AEPS_1');
            setPlans(data || []);
            if (data && data.length > 0) {
                const currentSelected = selectedPlanId 
                    ? data.find(p => p.id === selectedPlanId) || data[0]
                    : (data.find(p => p.isDefault) || data[0]);
                
                setSelectedPlanId(currentSelected.id);
                setSlabs(JSON.parse(JSON.stringify(currentSelected.slabs || [])));
                setOriginalSlabs(JSON.parse(JSON.stringify(currentSelected.slabs || [])));
            }
        } catch (err) {
            setNotification({ type: 'error', message: err.message || 'Failed to load AEPS commission plans.' });
        } finally {
            setLoadingPlans(false);
        }
    };

    useEffect(() => {
        if (commissionModel === 'AEPS_1') {
            fetchAepsPlans();
        }
    }, [commissionModel, selectedService]);

    // ── 2. FETCH BBPS CONFIGS ───────────────────────────────────────────────────
    const fetchBbpsConfigs = async (serviceId) => {
        setLoadingBbpsConfigs(true);
        try {
            const data = await commissionService.getBbpsConfigs(serviceId);
            setBbpsConfigs(data || []);
            if (data && data.length > 0) {
                const currentPlanConfig = data.find(c => c.planCode === selectedBbpsPlanCode) || data[0];
                setSelectedBbpsPlanCode(currentPlanConfig.planCode);
                const formVals = {
                    retailerPercentage: String(currentPlanConfig.retailerPercentage ?? '0.00'),
                    distributorPercentage: String(currentPlanConfig.distributorPercentage ?? '0.00'),
                    superDistributorPercentage: String(currentPlanConfig.superDistributorPercentage ?? '0.00'),
                    enabled: currentPlanConfig.enabled ?? true
                };
                setBbpsFormData(formVals);
                setOriginalBbpsFormData(JSON.parse(JSON.stringify(formVals)));
            }
        } catch (err) {
            setNotification({ type: 'error', message: err.message || 'Failed to load BBPS commission configuration.' });
        } finally {
            setLoadingBbpsConfigs(false);
        }
    };

    useEffect(() => {
        if (commissionModel === 'BBPS' && selectedBbpsServiceId) {
            fetchBbpsConfigs(selectedBbpsServiceId);
        }
    }, [commissionModel, selectedBbpsServiceId]);

    // When switching BBPS plan
    const handleSelectBbpsPlan = (planCode) => {
        setSelectedBbpsPlanCode(planCode);
        const config = bbpsConfigs.find(c => c.planCode === planCode);
        if (config) {
            const formVals = {
                retailerPercentage: String(config.retailerPercentage ?? '0.00'),
                distributorPercentage: String(config.distributorPercentage ?? '0.00'),
                superDistributorPercentage: String(config.superDistributorPercentage ?? '0.00'),
                enabled: config.enabled ?? true
            };
            setBbpsFormData(formVals);
            setOriginalBbpsFormData(JSON.parse(JSON.stringify(formVals)));
        }
        setNotification(null);
    };

    // ── 3. FETCH HISTORY ────────────────────────────────────────────────────────
    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            let filterSvc = historyServiceFilter;
            if (filterSvc === 'ALL') {
                if (commissionModel === 'AEPS_1') filterSvc = 'AEPS_1';
                else if (commissionModel === 'RECHARGE') filterSvc = 'MOBILE_RECHARGE';
                else filterSvc = 'ALL';
            }
            const res = await commissionService.getAdminTransactions({
                serviceType: filterSvc !== 'ALL' ? filterSvc : undefined,
                status: historyStatus !== 'ALL' ? historyStatus : undefined,
                search: historySearch,
                page: historyPage,
                size: historySize
            });
            setHistoryList(res?.content || []);
            setHistoryTotal(res?.totalElements || 0);
        } catch (err) {
            console.error('Failed to load commission transactions:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, historyPage, historyStatus, historyServiceFilter, commissionModel]);

    // ── CELEBRATION EFFECT ──────────────────────────────────────────────────────
    const triggerConfetti = () => {
        try {
            confetti({
                particleCount: 120,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#ec4899']
            });
            setTimeout(() => {
                confetti({
                    particleCount: 60,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#10b981', '#6366f1', '#f59e0b']
                });
                confetti({
                    particleCount: 60,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#10b981', '#6366f1', '#f59e0b']
                });
            }, 200);
        } catch (_) {}
    };

    // ── AEPS 1 SLABS EDIT HANDLERS ──────────────────────────────────────────────
    const handleSelectPlan = (plan) => {
        setSelectedPlanId(plan.id);
        setSlabs(JSON.parse(JSON.stringify(plan.slabs || [])));
        setOriginalSlabs(JSON.parse(JSON.stringify(plan.slabs || [])));
        setNotification(null);
    };

    const handleSlabChange = (index, field, value) => {
        const updated = [...slabs];
        const numVal = value === '' ? '' : Math.max(0, parseFloat(value) || 0);
        updated[index] = {
            ...updated[index],
            [field]: numVal
        };
        setSlabs(updated);
    };

    const handleResetAeps = () => {
        setSlabs(JSON.parse(JSON.stringify(originalSlabs)));
        setNotification({ type: 'info', message: 'Slab values reverted to saved database configuration.' });
    };

    const aepsValidationError = useMemo(() => {
        for (let i = 0; i < slabs.length; i++) {
            const s = slabs[i];
            const ret = parseFloat(s.retailerCommission);
            const dist = parseFloat(s.distributorCommission);
            const sd = parseFloat(s.superDistributorCommission);

            if (isNaN(ret) || ret < 0) return `Slab #${i + 1}: Retailer commission must be a valid positive amount.`;
            if (isNaN(dist) || dist < 0) return `Slab #${i + 1}: Distributor commission cannot be negative.`;
            if (isNaN(sd) || sd < 0) return `Slab #${i + 1}: Super Distributor commission cannot be negative.`;
        }
        return null;
    }, [slabs]);

    const handleSaveAeps = async () => {
        if (aepsValidationError) {
            setNotification({ type: 'error', message: aepsValidationError });
            return;
        }
        setSaving(true);
        setNotification(null);
        try {
            const formattedSlabs = slabs.map(s => ({
                id: s.id,
                minAmount: Number(s.minAmount),
                maxAmount: Number(s.maxAmount),
                retailerCommission: Number(s.retailerCommission || 0),
                distributorCommission: Number(s.distributorCommission || 0),
                superDistributorCommission: Number(s.superDistributorCommission || 0),
                enabled: s.enabled ?? true
            }));

            const updatedPlan = await commissionService.updatePlanSlabs(selectedPlanId, formattedSlabs);
            setNotification({ type: 'success', message: 'AEPS 1 Slabs Saved Successfully' });
            triggerConfetti();

            setOriginalSlabs(JSON.parse(JSON.stringify(updatedPlan.slabs || [])));
            setSlabs(JSON.parse(JSON.stringify(updatedPlan.slabs || [])));
            setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
        } catch (err) {
            setNotification({ type: 'error', message: err.message || 'Failed to save AEPS commission configuration.' });
        } finally {
            setSaving(false);
        }
    };

    const hasAepsChanges = useMemo(() => {
        return JSON.stringify(slabs) !== JSON.stringify(originalSlabs);
    }, [slabs, originalSlabs]);

    // ── BBPS PERCENTAGE EDIT HANDLERS ───────────────────────────────────────────
    const activeBbpsConfig = useMemo(() => {
        return bbpsConfigs.find(c => c.planCode === selectedBbpsPlanCode);
    }, [bbpsConfigs, selectedBbpsPlanCode]);

    const bbpsTotalPercentage = useMemo(() => {
        const ret = parseFloat(bbpsFormData.retailerPercentage) || 0;
        const dist = parseFloat(bbpsFormData.distributorPercentage) || 0;
        const sd = parseFloat(bbpsFormData.superDistributorPercentage) || 0;
        return Number((ret + dist + sd).toFixed(4));
    }, [bbpsFormData]);

    const bbpsValidationError = useMemo(() => {
        const ret = parseFloat(bbpsFormData.retailerPercentage);
        const dist = parseFloat(bbpsFormData.distributorPercentage);
        const sd = parseFloat(bbpsFormData.superDistributorPercentage);

        if (isNaN(ret) || ret < 0) return 'Retailer commission percentage cannot be negative.';
        if (isNaN(dist) || dist < 0) return 'Distributor commission percentage cannot be negative.';
        if (isNaN(sd) || sd < 0) return 'Super Distributor commission percentage cannot be negative.';
        if (ret > 100 || dist > 100 || sd > 100) return 'Commission percentage cannot exceed 100%.';
        if (bbpsTotalPercentage > 100) return `Total commission (${bbpsTotalPercentage}%) exceeds the 100% maximum limit.`;
        return null;
    }, [bbpsFormData, bbpsTotalPercentage]);

    const hasBbpsChanges = useMemo(() => {
        if (!originalBbpsFormData) return false;
        return JSON.stringify(bbpsFormData) !== JSON.stringify(originalBbpsFormData);
    }, [bbpsFormData, originalBbpsFormData]);

    const handleResetBbps = () => {
        if (originalBbpsFormData) {
            setBbpsFormData(JSON.parse(JSON.stringify(originalBbpsFormData)));
            setNotification({ type: 'info', message: 'Values reverted to saved database configuration.' });
        }
    };

        const handleReconcileBbps = async () => {
        setReconciling(true);
        try {
            const res = await commissionService.reconcileBbpsCommissions();
            const count = res?.reconciledCount ?? 0;
            if (count > 0) {
                setNotification({
                    type: 'success',
                    message: `Successfully reconciled and credited commissions for ${count} BBPS transaction(s)!`
                });
                triggerConfetti();
            } else {
                setNotification({
                    type: 'info',
                    message: 'All BBPS transactions are already up to date with full commission credits.'
                });
            }
            fetchHistory();
        } catch (err) {
            setNotification({
                type: 'error',
                message: err.message || 'Failed to reconcile BBPS commissions.'
            });
        } finally {
            setReconciling(false);
        }
    };

    const handleSaveBbps = async () => {
        if (!activeBbpsConfig) return;
        if (bbpsValidationError) {
            setNotification({ type: 'error', message: bbpsValidationError });
            return;
        }

        setSaving(true);
        setNotification(null);
        try {
            const ret = parseFloat(bbpsFormData.retailerPercentage) || 0;
            const dist = parseFloat(bbpsFormData.distributorPercentage) || 0;
            const sd = parseFloat(bbpsFormData.superDistributorPercentage) || 0;
            const isAnyConfigured = (ret > 0 || dist > 0 || sd > 0);

            const req = {
                retailerPercentage: ret,
                distributorPercentage: dist,
                superDistributorPercentage: sd,
                enabled: bbpsFormData.enabled || isAnyConfigured
            };

            const updated = await commissionService.updateBbpsConfig(activeBbpsConfig.id, req);
            setNotification({ type: 'success', message: `BBPS ${activeBbpsConfig.serviceName} (${activeBbpsConfig.planName}) configuration saved successfully!` });
            triggerConfetti();

            setBbpsConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
            const newForm = {
                retailerPercentage: String(updated.retailerPercentage ?? '0.00'),
                distributorPercentage: String(updated.distributorPercentage ?? '0.00'),
                superDistributorPercentage: String(updated.superDistributorPercentage ?? '0.00'),
                enabled: updated.enabled ?? true
            };
            setBbpsFormData(newForm);
            setOriginalBbpsFormData(JSON.parse(JSON.stringify(newForm)));
        } catch (err) {
            setNotification({ type: 'error', message: err.message || 'Failed to save BBPS commission configuration.' });
        } finally {
            setSaving(false);
        }
    };

    // ── SIMULATED CALCULATIONS ──────────────────────────────────────────────────
    const simAmount = parseFloat(simulatedAmount) || 0;
    const simRetCommission = useMemo(() => {
        const pct = parseFloat(bbpsFormData.retailerPercentage) || 0;
        return Number(((simAmount * pct) / 100).toFixed(2));
    }, [simAmount, bbpsFormData.retailerPercentage]);

    const simDistCommission = useMemo(() => {
        const pct = parseFloat(bbpsFormData.distributorPercentage) || 0;
        return Number(((simAmount * pct) / 100).toFixed(2));
    }, [simAmount, bbpsFormData.distributorPercentage]);

    const simSdCommission = useMemo(() => {
        const pct = parseFloat(bbpsFormData.superDistributorPercentage) || 0;
        return Number(((simAmount * pct) / 100).toFixed(2));
    }, [simAmount, bbpsFormData.superDistributorPercentage]);

    const simTotalCommission = useMemo(() => {
        return Number((simRetCommission + simDistCommission + simSdCommission).toFixed(2));
    }, [simRetCommission, simDistCommission, simSdCommission]);

    // ── MOBILE & DTH RECHARGE HANDLERS & HELPERS ────────────────────────────────
    const fetchRechargeOperators = async (category = 'MOBILE') => {
        setLoadingRechargeOperators(true);
        try {
            const data = await commissionService.getRechargeOperators(category);
            setRechargeOperators(data || []);
        } catch (err) {
            setNotification({ type: 'error', message: err.message || 'Failed to load operators.' });
        } finally {
            setLoadingRechargeOperators(false);
        }
    };

    const fetchRechargeConfigs = async (serviceType, opCode) => {
        setLoadingRechargeConfigs(true);
        try {
            const data = await commissionService.getRechargeConfigs(opCode, serviceType);
            setRechargeConfigs(data || []);
            if (data && data.length > 0) {
                const currentPlanConfig = data.find(c => c.planCode === selectedRechargePlanCode) || data[0];
                setSelectedRechargePlanCode(currentPlanConfig.planCode);
                const formVals = {
                    commissionMode: currentPlanConfig.commissionMode || 'PERCENTAGE',
                    retailerValue: String(currentPlanConfig.retailerValue ?? '0.00'),
                    distributorValue: String(currentPlanConfig.distributorValue ?? '0.00'),
                    superDistributorValue: String(currentPlanConfig.superDistributorValue ?? '0.00'),
                    enabled: currentPlanConfig.enabled ?? true
                };
                setRechargeFormData(formVals);
                setOriginalRechargeFormData(JSON.parse(JSON.stringify(formVals)));
            }
        } catch (err) {
            setNotification({ type: 'error', message: err.message || 'Failed to load recharge commission configs.' });
        } finally {
            setLoadingRechargeConfigs(false);
        }
    };

    const fetchRechargeAudits = async (serviceType, opCode) => {
        try {
            const data = await commissionService.getRechargeAudits(opCode, serviceType);
            setRechargeAudits(data || []);
        } catch (_) {}
    };

    useEffect(() => {
        if (commissionModel === 'RECHARGE') {
            fetchRechargeOperators(rechargeCategory);
        }
    }, [commissionModel, rechargeCategory]);

    const handleSelectRechargeOperator = (opCode, opName) => {
        setSelectedOperatorCode(opCode);
        setSelectedOperatorName(opName);
        setRechargeStep('configure');
        setRechargeSearch('');
        setNotification(null);
        fetchRechargeConfigs('MOBILE_RECHARGE', opCode);
        fetchRechargeAudits('MOBILE_RECHARGE', opCode);
    };

    const handleSelectRechargePlan = (planCode) => {
        setSelectedRechargePlanCode(planCode);
        const config = rechargeConfigs.find(c => c.planCode === planCode);
        if (config) {
            const formVals = {
                commissionMode: config.commissionMode || 'PERCENTAGE',
                retailerValue: String(config.retailerValue ?? '0.00'),
                distributorValue: String(config.distributorValue ?? '0.00'),
                superDistributorValue: String(config.superDistributorValue ?? '0.00'),
                enabled: config.enabled ?? true
            };
            setRechargeFormData(formVals);
            setOriginalRechargeFormData(JSON.parse(JSON.stringify(formVals)));
        }
        setNotification(null);
    };

    const handleRechargeModeChange = (newMode) => {
        if (newMode === rechargeFormData.commissionMode) return;
        setRechargeFormData(prev => ({
            ...prev,
            commissionMode: newMode
        }));
    };

    const activeRechargeConfig = useMemo(() => {
        return rechargeConfigs.find(c => c.planCode === selectedRechargePlanCode);
    }, [rechargeConfigs, selectedRechargePlanCode]);

    const isRechargePercentage = rechargeFormData.commissionMode === 'PERCENTAGE';

    const rechargeTotalValue = useMemo(() => {
        const ret = parseFloat(rechargeFormData.retailerValue) || 0;
        const dist = parseFloat(rechargeFormData.distributorValue) || 0;
        const sd = parseFloat(rechargeFormData.superDistributorValue) || 0;
        return Number((ret + dist + sd).toFixed(4));
    }, [rechargeFormData]);

    const rechargeValidationError = useMemo(() => {
        const ret = parseFloat(rechargeFormData.retailerValue);
        const dist = parseFloat(rechargeFormData.distributorValue);
        const sd = parseFloat(rechargeFormData.superDistributorValue);

        if (isNaN(ret) || ret < 0) return 'Retailer commission value cannot be negative.';
        if (isNaN(dist) || dist < 0) return 'Distributor commission value cannot be negative.';
        if (isNaN(sd) || sd < 0) return 'Super Distributor commission value cannot be negative.';

        if (isRechargePercentage) {
            if (ret > 100 || dist > 100 || sd > 100) return 'Commission percentage cannot exceed 100%.';
            if (rechargeTotalValue > 100) return `Total combined commission (${rechargeTotalValue}%) exceeds the 100% maximum limit.`;
        } else {
            if (ret > 5000 || dist > 5000 || sd > 5000) return 'Fixed commission cannot exceed ₹5,000.';
        }
        return null;
    }, [rechargeFormData, rechargeTotalValue, isRechargePercentage]);

    const hasRechargeChanges = useMemo(() => {
        if (!originalRechargeFormData) return false;
        return JSON.stringify(rechargeFormData) !== JSON.stringify(originalRechargeFormData);
    }, [rechargeFormData, originalRechargeFormData]);

    const handleResetRecharge = () => {
        if (originalRechargeFormData) {
            setRechargeFormData(JSON.parse(JSON.stringify(originalRechargeFormData)));
            setNotification({ type: 'info', message: 'Values reverted to saved database configuration.' });
        }
    };

    const handleSaveRecharge = async () => {
        if (!activeRechargeConfig) return;
        if (rechargeValidationError) {
            setNotification({ type: 'error', message: rechargeValidationError });
            return;
        }

        setSaving(true);
        setNotification(null);
        try {
            const ret = parseFloat(rechargeFormData.retailerValue) || 0;
            const dist = parseFloat(rechargeFormData.distributorValue) || 0;
            const sd = parseFloat(rechargeFormData.superDistributorValue) || 0;

            const req = {
                commissionMode: rechargeFormData.commissionMode,
                retailerValue: ret,
                distributorValue: dist,
                superDistributorValue: sd,
                enabled: rechargeFormData.enabled
            };

            const updated = await commissionService.updateRechargeConfig(activeRechargeConfig.id, req);
            setNotification({
                type: 'success',
                message: `${selectedOperatorName} (${activeRechargeConfig.planName}) Commission Saved Successfully`
            });
            triggerConfetti();

            setRechargeConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
            const newForm = {
                commissionMode: updated.commissionMode,
                retailerValue: String(updated.retailerValue),
                distributorValue: String(updated.distributorValue),
                superDistributorValue: String(updated.superDistributorValue),
                enabled: updated.enabled
            };
            setRechargeFormData(newForm);
            setOriginalRechargeFormData(JSON.parse(JSON.stringify(newForm)));

            fetchRechargeOperators(rechargeCategory);
            fetchRechargeAudits('MOBILE_RECHARGE', selectedOperatorCode);
        } catch (err) {
            setNotification({
                type: 'error',
                message: err.message || 'Failed to save recharge commission configuration.'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleReconcileRecharge = async () => {
        setReconciling(true);
        try {
            const res = await commissionService.reconcileRechargeCommissions();
            const count = res?.reconciledCount ?? 0;
            if (count > 0) {
                setNotification({
                    type: 'success',
                    message: `Successfully reconciled and credited commissions for ${count} Mobile Recharge transaction(s)!`
                });
                triggerConfetti();
            } else {
                setNotification({
                    type: 'info',
                    message: 'All Mobile Recharge transactions are already up to date with full commission credits.'
                });
            }
            fetchHistory();
        } catch (err) {
            setNotification({
                type: 'error',
                message: err.message || 'Failed to reconcile Mobile Recharge commissions.'
            });
        } finally {
            setReconciling(false);
        }
    };

    const simRechargeAmountNum = Math.max(1, parseFloat(simulatedRechargeAmount) || 500);

    const simRechargeRetailer = useMemo(() => {
        const val = parseFloat(rechargeFormData.retailerValue) || 0;
        return isRechargePercentage ? Number(((simRechargeAmountNum * val) / 100).toFixed(2)) : Number(val.toFixed(2));
    }, [simRechargeAmountNum, rechargeFormData.retailerValue, isRechargePercentage]);

    const simRechargeDistributor = useMemo(() => {
        const val = parseFloat(rechargeFormData.distributorValue) || 0;
        return isRechargePercentage ? Number(((simRechargeAmountNum * val) / 100).toFixed(2)) : Number(val.toFixed(2));
    }, [simRechargeAmountNum, rechargeFormData.distributorValue, isRechargePercentage]);

    const simRechargeSuperDist = useMemo(() => {
        const val = parseFloat(rechargeFormData.superDistributorValue) || 0;
        return isRechargePercentage ? Number(((simRechargeAmountNum * val) / 100).toFixed(2)) : Number(val.toFixed(2));
    }, [simRechargeAmountNum, rechargeFormData.superDistributorValue, isRechargePercentage]);

    const simRechargeTotal = Number((simRechargeRetailer + simRechargeDistributor + simRechargeSuperDist).toFixed(2));

    const filteredOperators = useMemo(() => {
        if (!rechargeSearch.trim()) return rechargeOperators;
        const q = rechargeSearch.toLowerCase().trim();
        return rechargeOperators.filter(op =>
            op.operatorName.toLowerCase().includes(q) ||
            op.operatorCode.toLowerCase().includes(q)
        );
    }, [rechargeOperators, rechargeSearch]);

    const getOperatorStyle = (code) => {
        switch (String(code || '').toUpperCase()) {
            case 'JRE':
            case 'JTU':
                return { bg: 'bg-blue-600', text: 'text-white', badge: 'bg-blue-50 text-blue-900 border-blue-200' };
            case 'ATL':
            case 'ACL':
                return { bg: 'bg-red-600', text: 'text-white', badge: 'bg-red-50 text-red-900 border-red-200' };
            case 'VDF':
                return { bg: 'bg-amber-600', text: 'text-white', badge: 'bg-amber-50 text-amber-900 border-amber-200' };
            case 'BNT':
            case 'BNV':
                return { bg: 'bg-emerald-700', text: 'text-white', badge: 'bg-emerald-50 text-emerald-900 border-emerald-200' };
            case 'VCT':
            case 'VCV':
                return { bg: 'bg-cyan-700', text: 'text-white', badge: 'bg-cyan-50 text-cyan-900 border-cyan-200' };
            default:
                return { bg: 'bg-slate-700', text: 'text-white', badge: 'bg-slate-50 text-slate-900 border-slate-200' };
        }
    };

    const getRechargePlanDisplayName = (config) => {
        if (!config) return 'Free Plan';
        const code = String(config.planCode || '').toUpperCase();
        if (code === 'PLAN_2999') return 'Rupiksha Anand Plan';
        if (code === 'PLAN_4999') return 'Rupiksha Nidhi Plan';
        if (code === 'PLAN_7999') return 'Rupiksha Dhanbarsha Plan';
        if (code === 'FREE') return 'Free Plan';
        return config.planName || 'Plan';
    };

    // ── SERVICE SELECTION HELPERS ───────────────────────────────────────────────
    const activePlan = plans.find(p => p.id === selectedPlanId);

    const getAdminPlanDisplayName = (plan) => {
        if (!plan) return 'Free Plan';
        const code = String(plan.planCode || '').toUpperCase();
        const name = String(plan.planName || '');
        if (code === 'PLAN_2999' || name.includes('2999') || name.toLowerCase().includes('anand')) return 'Rupiksha Anand Plan';
        if (code === 'PLAN_4999' || name.includes('4999') || name.toLowerCase().includes('nidhi')) return 'Rupiksha Nidhi Plan';
        if (code === 'PLAN_7999' || name.includes('7999') || name.toLowerCase().includes('dhanbarsha')) return 'Rupiksha Dhanbarsha Plan';
        if (code === 'FREE' || name.toLowerCase().includes('free')) return 'Free Plan';
        return name || 'Commission Plan';
    };

    const getBbpsPlanDisplayName = (config) => {
        if (!config) return 'Free Plan';
        const code = String(config.planCode || '').toUpperCase();
        if (code === 'PLAN_2999') return 'Rupiksha Anand Plan';
        if (code === 'PLAN_4999') return 'Rupiksha Nidhi Plan';
        if (code === 'PLAN_7999') return 'Rupiksha Dhanbarsha Plan';
        if (code === 'FREE') return 'Free Plan';
        return config.planName || 'Plan';
    };

    const filteredBbpsCategories = useMemo(() => {
        if (!bbpsSearch.trim()) return BBPS_CATEGORIES;
        const q = bbpsSearch.toLowerCase();
        return BBPS_CATEGORIES.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q)
        );
    }, [bbpsSearch]);

    const selectedBbpsCategory = useMemo(() => {
        return BBPS_CATEGORIES.find(c => c.id === selectedBbpsServiceId) || {
            id: 'loan-repayment',
            name: 'Loan Repayment',
            icon: HandCoins,
            gradient: 'from-emerald-600 to-teal-700',
            description: 'Pay EMI installments for personal loans, home loans, vehicle loans, and NBFCs'
        };
    }, [selectedBbpsServiceId]);

    const isServiceActive = selectedBbpsServiceId === 'loan-repayment' || selectedBbpsServiceId === 'electricity';

    const renderCommissionModelDropdown = () => {
        const currentModel = COMMISSION_MODELS.find(m => m.id === commissionModel) || COMMISSION_MODELS[0];
        const isBbps = commissionModel === 'BBPS';
        const isRecharge = commissionModel === 'RECHARGE';

        return (
            <div className="space-y-1.5 relative" ref={modelDropdownRef}>
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-black uppercase tracking-wider block">
                        Commission Model
                    </label>
                    <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md border ${
                        isRecharge
                            ? 'bg-blue-50 text-blue-950 border-blue-300'
                            : isBbps 
                            ? 'bg-emerald-50 text-emerald-950 border-emerald-300' 
                            : 'bg-indigo-50 text-indigo-950 border-indigo-300'
                    }`}>
                        {currentModel.badge}
                    </span>
                </div>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsModelDropdownOpen(prev => !prev)}
                        className={`w-full bg-slate-50 border rounded-2xl px-3.5 py-2.5 text-xs font-black text-black transition-all flex items-center justify-between cursor-pointer shadow-xs outline-none ${
                            isModelDropdownOpen
                                ? isRecharge
                                    ? 'border-blue-600 ring-2 ring-blue-500/20 bg-white'
                                    : isBbps
                                    ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-white'
                                    : 'border-indigo-600 ring-2 ring-indigo-500/20 bg-white'
                                : 'border-slate-300 hover:border-slate-400 hover:bg-white'
                        }`}
                        aria-expanded={isModelDropdownOpen}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                isRecharge
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : isBbps
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-indigo-600 text-white shadow-xs'
                            }`}>
                                {isRecharge ? <Smartphone size={15} /> : isBbps ? <Percent size={15} /> : <Layers size={15} />}
                            </div>
                            <div className="text-left min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-black text-black text-xs block truncate">
                                        {currentModel.label}
                                    </span>
                                    {isBbps && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    )}
                                    {isRecharge && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                    )}
                                </div>
                                <span className="text-[10px] font-bold text-slate-800 block truncate">
                                    {currentModel.sublabel}
                                </span>
                            </div>
                        </div>
                        <ChevronDown size={15} className={`text-black transition-transform duration-200 shrink-0 ml-2 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {isModelDropdownOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                transition={{ duration: 0.15 }}
                                className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-300 rounded-2xl shadow-xl p-1.5 space-y-1"
                            >
                                {COMMISSION_MODELS.map(m => {
                                    const isSelected = commissionModel === m.id;
                                    const IconComp = m.icon;
                                    const isMbbps = m.id === 'BBPS';
                                    const isMrecharge = m.id === 'RECHARGE';

                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => {
                                                handleModelChange(m.id);
                                                setIsModelDropdownOpen(false);
                                            }}
                                            className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                                isSelected
                                                    ? 'bg-slate-900 text-white shadow-xs'
                                                    : 'hover:bg-slate-100 text-black'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                    isSelected 
                                                        ? 'bg-white/20 text-white' 
                                                        : isMrecharge
                                                        ? 'bg-blue-50 text-blue-800'
                                                        : isMbbps
                                                        ? 'bg-emerald-50 text-emerald-800'
                                                        : 'bg-indigo-50 text-indigo-800'
                                                }`}>
                                                    <IconComp size={14} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="text-xs font-black truncate">{m.label}</p>
                                                        {isMbbps && (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        )}
                                                        {isMrecharge && (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                                        )}
                                                    </div>
                                                    <p className={`text-[10px] font-bold truncate ${isSelected ? 'text-slate-200' : 'text-slate-700'}`}>
                                                        {m.sublabel}
                                                    </p>
                                                </div>
                                            </div>
                                            {isSelected && <Check size={14} className="text-emerald-400 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto font-['Inter',sans-serif]">
            {/* ── TOP HEADER & TAB BAR ────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
                        <IndianRupee size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-black bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
                                Operations &bull; Master
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-black bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
                                Multi-Model Architecture
                            </span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-black text-black tracking-tight mt-0.5">
                            Commission Management
                        </h1>
                    </div>
                </div>

                {/* Main View Tabs (Config vs History) */}
                <div className="inline-flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-300 self-start sm:self-center">
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'config'
                                ? 'bg-black text-white shadow-md'
                                : 'text-black hover:text-blue-700'
                        }`}
                    >
                        <Layers size={14} />
                        Plan Config
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'history'
                                ? 'bg-black text-white shadow-md'
                                : 'text-black hover:text-blue-700'
                        }`}
                    >
                        <History size={14} />
                        Audit Ledger
                    </button>
                </div>
            </div>

            {/* ── NOTIFICATION TOAST ────────────────────────────────────────────── */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`p-4 rounded-2xl flex items-center justify-between border text-xs font-bold ${
                            notification.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : notification.type === 'error'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            {notification.type === 'success' && <CheckCircle2 size={18} className="text-emerald-600" />}
                            {notification.type === 'error' && <ShieldAlert size={18} className="text-rose-600" />}
                            {notification.type === 'info' && <HelpCircle size={18} className="text-blue-600" />}
                            <span>{notification.message}</span>
                        </div>
                        <button
                            onClick={() => setNotification(null)}
                            className="text-slate-400 hover:text-slate-600 text-sm font-black px-2 cursor-pointer"
                        >
                            &times;
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── MAIN TAB: CONFIGURATION ──────────────────────────────────────── */}
            {activeTab === 'config' ? (
                commissionModel === 'RECHARGE' ? (
                    rechargeStep === 'select-operator' ? (
                        /* ── RECHARGE STEP 1: OPERATOR SELECTION SCREEN ───────────────── */
                        <div className="space-y-6">
                            {/* Recharge Header & Controls */}
                            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-xl md:text-2xl font-black text-black tracking-tight">
                                                Mobile & DTH Recharge Commission
                                            </h2>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-black bg-blue-50 px-3 py-1 rounded-full border border-blue-300 shadow-2xs">
                                                Flexible % / Fixed ₹
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 mt-1">
                                            Configure operator commissions with Percentage (%) or Fixed Rupee (₹) modes across all membership plans.
                                        </p>
                                    </div>

                                    {/* Model Switcher Dropdown */}
                                    <div className="w-full sm:w-60">
                                        <label className="text-[10px] font-black uppercase text-black tracking-wider block mb-1">
                                            Commission Model
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={commissionModel}
                                                onChange={(e) => handleModelChange(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-xs font-black text-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all appearance-none cursor-pointer pr-9 shadow-2xs"
                                            >
                                                {COMMISSION_MODELS.map(m => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.label} ({m.sublabel})
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                {/* ── SERVICE CATEGORY SELECTOR (Mobile Recharge vs DTH Recharge) ── */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Category A: Mobile Recharge */}
                                    <button
                                        type="button"
                                        onClick={() => setRechargeCategory('MOBILE')}
                                        className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 ${
                                            rechargeCategory === 'MOBILE'
                                                ? 'bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
                                        }`}
                                    >
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                            rechargeCategory === 'MOBILE' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-black'
                                        }`}>
                                            <Smartphone size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-black text-black tracking-tight">Mobile Recharge</h3>
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-950 border border-emerald-300">
                                                    Active
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 mt-1 line-clamp-2">
                                                Configure commissions for Jio, Airtel, Vi, BSNL, and Videocon across all 4 plans.
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200">
                                                    {rechargeOperators.length > 0 ? `${rechargeOperators.length} Operators Available` : '9 Operators Configured'}
                                                </span>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Category B: DTH Recharge */}
                                    <button
                                        type="button"
                                        onClick={() => setRechargeCategory('DTH')}
                                        className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 ${
                                            rechargeCategory === 'DTH'
                                                ? 'bg-amber-50/70 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
                                        }`}
                                    >
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                            rechargeCategory === 'DTH' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-black'
                                        }`}>
                                            <Tv size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-black text-black tracking-tight">DTH Recharge</h3>
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-950 border border-amber-300">
                                                    Future Activation
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 mt-1 line-clamp-2">
                                                Tata Play, Airtel DTH, Dish TV, Sun Direct. Commission configuration will be activated upon transaction integration.
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                                                    Disabled / Coming Soon
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {/* Content based on Category */}
                                {rechargeCategory === 'DTH' ? (
                                    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center space-y-4">
                                        <div className="w-16 h-16 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto border border-amber-300 shadow-sm">
                                            <Tv size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-black">DTH Recharge Commission is Coming Soon</h3>
                                            <p className="text-xs font-bold text-slate-800 max-w-lg mx-auto mt-1.5 leading-relaxed">
                                                DTH Recharge uses a separate transaction lifecycle and provider routing engine. To prevent accidental commission credits, DTH commission distribution is safely locked until provider mapping is explicitly enabled.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setRechargeCategory('MOBILE')}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                                        >
                                            <Smartphone size={14} />
                                            Switch to Mobile Recharge
                                        </button>
                                    </div>
                                ) : (
                                    /* MOBILE RECHARGE OPERATOR CATALOG */
                                    <div className="space-y-4">
                                        {/* Search & Actions Bar */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="relative flex-1 max-w-md">
                                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                                <input
                                                    type="text"
                                                    placeholder="Search mobile operators (e.g. Jio, Airtel, Vi)..."
                                                    value={rechargeSearch}
                                                    onChange={(e) => setRechargeSearch(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-black text-black placeholder:text-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                                <button
                                                    onClick={handleReconcileRecharge}
                                                    disabled={reconciling}
                                                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-black transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                                                    title="Reconcile missing commissions for completed mobile recharges"
                                                >
                                                    <Sparkles size={14} className={reconciling ? 'animate-spin text-blue-600' : 'text-blue-600'} />
                                                    <span>{reconciling ? 'Reconciling...' : 'Reconcile Commissions'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Operator Cards Grid */}
                                        {loadingRechargeOperators ? (
                                            <div className="py-16 text-center text-black font-black">
                                                <RefreshCw className="animate-spin mx-auto mb-2 text-blue-600" size={24} />
                                                Loading authorized mobile operators from provider...
                                            </div>
                                        ) : filteredOperators.length === 0 ? (
                                            <div className="py-12 text-center text-black font-black bg-slate-50 rounded-2xl border border-slate-200">
                                                No mobile operators match your search &ldquo;{rechargeSearch}&rdquo;.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {filteredOperators.map(op => {
                                                    const style = getOperatorStyle(op.operatorCode);
                                                    return (
                                                        <div
                                                            key={op.operatorCode}
                                                            className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between gap-4 group"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${style.bg} ${style.text}`}>
                                                                        {op.operatorCode}
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-sm font-black text-black group-hover:text-blue-700 transition-colors">
                                                                            {op.operatorName}
                                                                        </h4>
                                                                        <span className="text-[10px] font-bold text-slate-700 font-mono">
                                                                            Code: {op.operatorCode}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                                                                    op.commissionMode === 'FIXED'
                                                                        ? 'bg-amber-50 text-amber-950 border-amber-300'
                                                                        : 'bg-emerald-50 text-emerald-950 border-emerald-300'
                                                                }`}>
                                                                    {op.commissionMode === 'FIXED' ? 'Fixed ₹' : 'Percentage %'}
                                                                </span>
                                                            </div>

                                                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                                    <span className="text-[11px] font-bold text-slate-800">
                                                                        4 Plans Supported
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSelectRechargeOperator(op.operatorCode, op.operatorName)}
                                                                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                                                >
                                                                    <span>Configure</span>
                                                                    <ArrowRight size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* ── RECHARGE STEP 2: OPERATOR PLAN CONFIGURATION ─────────────── */
                        <div className="space-y-6">
                            {/* Navigation & Operator Header */}
                            <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRechargeStep('select-operator')}
                                        className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-black flex items-center justify-center transition-colors cursor-pointer border border-slate-300 shrink-0"
                                        title="Back to operator catalogue"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-[11px] shadow-2xs ${getOperatorStyle(selectedOperatorCode).bg} ${getOperatorStyle(selectedOperatorCode).text}`}>
                                                {selectedOperatorCode}
                                            </div>
                                            <h2 className="text-lg md:text-xl font-black text-black">
                                                {selectedOperatorName} Commission
                                            </h2>
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-950 border border-blue-300">
                                                Mobile Recharge
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 mt-0.5">
                                            Configure Percentage (%) or Fixed (₹) commission across all 4 membership plans.
                                        </p>
                                    </div>
                                </div>

                                {/* Quick Switch Operator Dropdown */}
                                <div className="flex items-center gap-3 self-end md:self-auto">
                                    <div className="w-48 sm:w-56">
                                        <div className="relative">
                                            <select
                                                value={selectedOperatorCode}
                                                onChange={(e) => {
                                                    const found = rechargeOperators.find(o => o.operatorCode === e.target.value);
                                                    handleSelectRechargeOperator(e.target.value, found?.operatorName || e.target.value);
                                                }}
                                                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2 text-xs font-black text-black focus:bg-white focus:outline-none cursor-pointer pr-8 shadow-2xs"
                                            >
                                                {rechargeOperators.map(op => (
                                                    <option key={op.operatorCode} value={op.operatorCode}>
                                                        {op.operatorName} ({op.operatorCode})
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleReconcileRecharge}
                                        disabled={reconciling}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-black transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                                        title="Scan and credit missing commissions"
                                    >
                                        <Sparkles size={14} className={reconciling ? 'animate-spin text-blue-600' : 'text-blue-600'} />
                                        <span className="hidden sm:inline">{reconciling ? 'Reconciling...' : 'Reconcile'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Main Configuration Columns */}
                            {loadingRechargeConfigs ? (
                                <div className="bg-white rounded-3xl p-16 text-center text-black font-black border border-slate-200">
                                    <RefreshCw className="animate-spin mx-auto mb-2 text-blue-600" size={24} />
                                    Loading {selectedOperatorName} commission configurations...
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                    {/* Left Column: Plan Selectors, Mode Switcher & Inputs */}
                                    <div className="lg:col-span-5 space-y-6">
                                        {/* 1. Four Membership Plans Selector */}
                                        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-black uppercase text-black tracking-wider block">
                                                    Membership Plan
                                                </label>
                                                <span className="text-[10px] font-bold text-slate-700">4 Plans Configurable</span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2.5">
                                                {rechargeConfigs.map(c => {
                                                    const isSelected = selectedRechargePlanCode === c.planCode;
                                                    const displayName = getRechargePlanDisplayName(c);
                                                    const priceNum = Number(c.planPrice || 0);

                                                    return (
                                                        <button
                                                            key={c.planCode}
                                                            type="button"
                                                            onClick={() => handleSelectRechargePlan(c.planCode)}
                                                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                                                isSelected
                                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                                                                    : 'bg-slate-50 hover:bg-white text-black border-slate-200'
                                                            }`}
                                                        >
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-wider opacity-70">
                                                                    {c.planCode}
                                                                </p>
                                                                <h4 className="text-xs font-black truncate mt-0.5">
                                                                    {displayName}
                                                                </h4>
                                                            </div>
                                                            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/40">
                                                                <span className="text-xs font-mono font-black">
                                                                    {priceNum === 0 ? 'Free' : `₹${priceNum.toLocaleString('en-IN')}`}
                                                                </span>
                                                                {isSelected && (
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* 2. Commission Calculation Mode Selector */}
                                        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-black uppercase text-black tracking-wider block">
                                                    Calculation Mode
                                                </label>
                                                <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                                    isRechargePercentage
                                                        ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                                                        : 'bg-amber-50 text-amber-950 border-amber-300'
                                                }`}>
                                                    {isRechargePercentage ? 'Percentage Mode' : 'Fixed Rupee Mode'}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRechargeModeChange('PERCENTAGE')}
                                                    className={`p-3 rounded-2xl border font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                                        isRechargePercentage
                                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                            : 'bg-slate-50 text-black border-slate-200 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <Percent size={14} />
                                                    <span>Percentage (%)</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRechargeModeChange('FIXED')}
                                                    className={`p-3 rounded-2xl border font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                                        !isRechargePercentage
                                                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                                            : 'bg-slate-50 text-black border-slate-200 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <IndianRupee size={14} />
                                                    <span>Fixed Amount (₹)</span>
                                                </button>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-700">
                                                {isRechargePercentage
                                                    ? 'Calculates commission as percentage of successful recharge amount.'
                                                    : 'Grants configured fixed rupee amount per successful recharge regardless of amount.'}
                                            </p>
                                        </div>

                                        {/* 3. Hierarchy Commission Inputs */}
                                        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                                <h3 className="text-xs font-black uppercase text-black tracking-wider">
                                                    Hierarchy Distribution Rates
                                                </h3>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <span className="text-[11px] font-bold text-slate-800">Enabled</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={rechargeFormData.enabled}
                                                        onChange={(e) => setRechargeFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                </label>
                                            </div>

                                            {/* Retailer */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <label className="text-xs font-black text-black">
                                                        Retailer Commission
                                                    </label>
                                                    <span className="text-[10px] font-bold text-slate-700">Role: Retailer</span>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max={isRechargePercentage ? "100" : "5000"}
                                                        value={rechargeFormData.retailerValue}
                                                        onChange={(e) => setRechargeFormData(prev => ({ ...prev, retailerValue: e.target.value }))}
                                                        className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-black text-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs pr-12"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-600">
                                                        {isRechargePercentage ? '%' : '₹'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Distributor */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <label className="text-xs font-black text-black">
                                                        Distributor Commission
                                                    </label>
                                                    <span className="text-[10px] font-bold text-slate-700">Role: Distributor</span>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max={isRechargePercentage ? "100" : "5000"}
                                                        value={rechargeFormData.distributorValue}
                                                        onChange={(e) => setRechargeFormData(prev => ({ ...prev, distributorValue: e.target.value }))}
                                                        className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-black text-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs pr-12"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-600">
                                                        {isRechargePercentage ? '%' : '₹'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Super Distributor */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <label className="text-xs font-black text-black">
                                                        Super Distributor Commission
                                                    </label>
                                                    <span className="text-[10px] font-bold text-slate-700">Role: Super Distributor</span>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max={isRechargePercentage ? "100" : "5000"}
                                                        value={rechargeFormData.superDistributorValue}
                                                        onChange={(e) => setRechargeFormData(prev => ({ ...prev, superDistributorValue: e.target.value }))}
                                                        className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-black text-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs pr-12"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-600">
                                                        {isRechargePercentage ? '%' : '₹'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Total Summary */}
                                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                                                <span className="text-xs font-bold text-black">Combined Distribution:</span>
                                                <span className="text-xs font-mono font-black text-blue-900">
                                                    {isRechargePercentage ? `${rechargeTotalValue.toFixed(2)}%` : `₹${rechargeTotalValue.toFixed(2)}`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Simulation Calculator, Breakdown & Actions */}
                                    <div className="lg:col-span-7 space-y-6">
                                        {/* 1. Live Simulation Card */}
                                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                                                <div>
                                                    <h3 className="text-base font-black text-black flex items-center gap-2">
                                                        <Calculator size={18} className="text-blue-600" />
                                                        Live Commission Simulator
                                                    </h3>
                                                    <p className="text-xs font-bold text-slate-700 mt-0.5">
                                                        Real-time preview of wallet earnings for a successful recharge.
                                                    </p>
                                                </div>

                                                {/* Amount Input */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-black">Recharge:</span>
                                                    <div className="relative w-28">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600">₹</span>
                                                        <input
                                                            type="number"
                                                            value={simulatedRechargeAmount}
                                                            onChange={(e) => setSimulatedRechargeAmount(e.target.value)}
                                                            className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-black text-black focus:bg-white focus:outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Breakdown Cards */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
                                                    <span className="text-[10px] font-black uppercase text-blue-950 block">Retailer Earns</span>
                                                    <p className="text-lg font-black font-mono text-blue-950 mt-1">
                                                        ₹{simRechargeRetailer.toFixed(2)}
                                                    </p>
                                                    <span className="text-[10px] font-bold text-blue-800">
                                                        {isRechargePercentage ? `${rechargeFormData.retailerValue}%` : 'Fixed ₹'}
                                                    </span>
                                                </div>

                                                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                                                    <span className="text-[10px] font-black uppercase text-amber-950 block">Distributor</span>
                                                    <p className="text-lg font-black font-mono text-amber-950 mt-1">
                                                        ₹{simRechargeDistributor.toFixed(2)}
                                                    </p>
                                                    <span className="text-[10px] font-bold text-amber-800">
                                                        {isRechargePercentage ? `${rechargeFormData.distributorValue}%` : 'Fixed ₹'}
                                                    </span>
                                                </div>

                                                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200">
                                                    <span className="text-[10px] font-black uppercase text-purple-950 block">Super Dist.</span>
                                                    <p className="text-lg font-black font-mono text-purple-950 mt-1">
                                                        ₹{simRechargeSuperDist.toFixed(2)}
                                                    </p>
                                                    <span className="text-[10px] font-bold text-purple-800">
                                                        {isRechargePercentage ? `${rechargeFormData.superDistributorValue}%` : 'Fixed ₹'}
                                                    </span>
                                                </div>

                                                <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xs">
                                                    <span className="text-[10px] font-bold uppercase text-slate-300 block">Total Disbursed</span>
                                                    <p className="text-lg font-black font-mono text-emerald-400 mt-1">
                                                        ₹{simRechargeTotal.toFixed(2)}
                                                    </p>
                                                    <span className="text-[10px] font-bold text-slate-300">
                                                        {isRechargePercentage ? `${rechargeTotalValue.toFixed(2)}% Total` : 'Fixed Total'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Hierarchy flow indicator */}
                                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-black font-bold flex flex-wrap items-center justify-between gap-2">
                                                <span>Hierarchy Flow:</span>
                                                <div className="flex items-center gap-2 text-xs font-mono font-black text-slate-800">
                                                    <span className="bg-purple-100 text-purple-950 px-2 py-0.5 rounded-md border border-purple-300">Super Dist (₹{simRechargeSuperDist.toFixed(2)})</span>
                                                    <span>&rarr;</span>
                                                    <span className="bg-amber-100 text-amber-950 px-2 py-0.5 rounded-md border border-amber-300">Dist (₹{simRechargeDistributor.toFixed(2)})</span>
                                                    <span>&rarr;</span>
                                                    <span className="bg-blue-100 text-blue-950 px-2 py-0.5 rounded-md border border-blue-300">Retailer (₹{simRechargeRetailer.toFixed(2)})</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Audit Trail Card */}
                                        {rechargeAudits.length > 0 && (
                                            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-black uppercase text-black tracking-wider flex items-center gap-2">
                                                        <History size={14} className="text-slate-600" />
                                                        Recent Configuration Changes ({selectedOperatorCode})
                                                    </h4>
                                                    <span className="text-[10px] font-bold text-slate-600">Audit Log</span>
                                                </div>
                                                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                                                    {rechargeAudits.slice(0, 4).map(a => (
                                                        <div key={a.id} className="py-2.5 text-xs flex items-center justify-between gap-2">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-black text-black">[{a.planCode}]</span>
                                                                    <span className="font-bold text-slate-700">Mode: {a.newCommissionMode}</span>
                                                                    <span className="text-emerald-700 font-mono font-bold">
                                                                        (Ret: {a.newRetailerValue}{a.newCommissionMode === 'FIXED' ? '₹' : '%'})
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] text-slate-600">by {a.adminUsername || 'admin'}</span>
                                                            </div>
                                                            <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
                                                                {new Date(a.createdAt).toLocaleDateString('en-IN')}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 3. Action Bar (Reset / Save) */}
                                        <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                                            <div>
                                                {hasRechargeChanges ? (
                                                    <span className="text-xs font-black text-amber-700 flex items-center gap-1.5">
                                                        <AlertTriangle size={14} />
                                                        You have unsaved commission changes for {selectedOperatorName} ({activeRechargeConfig?.planName}).
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                        <CheckCircle2 size={14} className="text-emerald-600" />
                                                        Configuration is saved and up to date with database.
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                                {hasRechargeChanges && (
                                                    <button
                                                        type="button"
                                                        onClick={handleResetRecharge}
                                                        disabled={saving}
                                                        className="px-4 py-2.5 rounded-2xl border border-slate-300 text-black text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-all flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <RotateCcw size={14} />
                                                        Reset
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={handleSaveRecharge}
                                                    disabled={saving || !hasRechargeChanges}
                                                    className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 text-white shadow-lg cursor-pointer ${
                                                        saving || !hasRechargeChanges
                                                            ? 'bg-slate-300 shadow-none cursor-not-allowed text-slate-600'
                                                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                                                    }`}
                                                >
                                                    <Save size={14} />
                                                    {saving ? 'Saving...' : 'Save Configuration'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                ) : commissionModel === 'BBPS' && bbpsStep === 'select-service' ? (
                    /* ── STEP 1: SELECT BBPS SERVICE SCREEN ───────────────────── */
                    <div className="space-y-6">
                        {/* BBPS Service Search & Selection Panel */}
                        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-xl md:text-2xl font-black text-black tracking-tight">
                                            Select BBPS Service
                                        </h2>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-black bg-slate-100 px-3 py-1 rounded-full border border-slate-300 shadow-2xs">
                                            35 Registered Services
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-800 mt-1">
                                        Select any Bharat Connect / BBPS service below to configure its percentage commission rates across membership plans.
                                    </p>
                                </div>

                                {/* Controls: Model Switcher + Quick Select Service */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                                    {/* Commission Model Selector */}
                                    <div className="w-full sm:w-56">
                                        <label className="text-[10px] font-black uppercase text-black tracking-wider block mb-1">
                                            Commission Model
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={commissionModel}
                                                onChange={(e) => handleModelChange(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-xs font-black text-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all appearance-none cursor-pointer pr-9 shadow-2xs"
                                            >
                                                {COMMISSION_MODELS.map(m => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.label} ({m.sublabel})
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Quick select service */}
                                    <div className="w-full sm:w-60">
                                        <label className="text-[10px] font-black uppercase text-black tracking-wider block mb-1">
                                            Quick Select Service
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={selectedBbpsServiceId}
                                                onChange={(e) => handleSelectBbpsService(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-xs font-black text-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all appearance-none cursor-pointer pr-9 shadow-2xs"
                                            >
                                                <option value="" disabled>-- Choose BBPS Service --</option>
                                                {BBPS_CATEGORIES.map(cat => (
                                                    <option key={cat.id} value={cat.id}>
                                                        {cat.name} {(cat.id === 'loan-repayment' || cat.id === 'electricity') ? '(Active)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Search input */}
                            <div className="relative">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700" />
                                <input
                                    type="text"
                                    placeholder="Search BBPS services by name, category, or keyword (e.g. Loan Repayment, Fastag, DTH, Electricity)..."
                                    value={bbpsSearch}
                                    onChange={(e) => setBbpsSearch(e.target.value)}
                                    className="w-full pl-11 pr-10 py-3.5 bg-slate-50/80 border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-black placeholder:text-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xs"
                                />
                                {bbpsSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setBbpsSearch('')}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-black cursor-pointer p-1"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Category Grid Section - Retailer Panel Style */}
                            {filteredBbpsCategories.length === 0 ? (
                                <div className="p-12 text-center text-slate-800 border border-dashed border-slate-300 rounded-3xl space-y-2">
                                    <Search size={32} className="mx-auto text-slate-600 mb-2" />
                                    <p className="text-base font-black text-black">No BBPS services found matching &ldquo;{bbpsSearch}&rdquo;</p>
                                    <p className="text-xs font-bold text-slate-800">Try searching for Fastag, Electricity, Water, Gas, or Loan Repayment.</p>
                                    <button
                                        type="button"
                                        onClick={() => setBbpsSearch('')}
                                        className="mt-3 px-4 py-2 text-xs font-black uppercase text-white bg-black hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                                    >
                                        Clear Search
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                                    {filteredBbpsCategories.map((cat, index) => {
                                        const isServiceReady = cat.id === 'loan-repayment' || cat.id === 'electricity';
                                        const isSelected = cat.id === selectedBbpsServiceId;
                                        const IconComp = cat.icon || HandCoins;
                                        const gradient = cat.gradient || 'from-indigo-500 to-blue-600';

                                        return (
                                            <motion.button
                                                key={cat.id}
                                                type="button"
                                                initial={{ opacity: 0, y: 16 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.3, delay: Math.min(index * 0.015, 0.3) }}
                                                whileHover={{ y: -6, scale: 1.02 }}
                                                whileTap={{ scale: 0.97 }}
                                                onClick={() => handleSelectBbpsService(cat.id)}
                                                className={`group relative overflow-hidden text-left rounded-3xl border p-5 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] hover:border-blue-400 hover:shadow-[0_20px_40px_rgba(59,130,246,0.18)] transition-all duration-300 cursor-pointer flex flex-col justify-between w-full ${
                                                    isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200'
                                                }`}
                                            >
                                                {/* Animated Liquid Background Bubble on Hover */}
                                                <div
                                                    className={`pointer-events-none absolute -bottom-12 -right-12 w-44 h-44 rounded-full bg-gradient-to-tr ${gradient} opacity-0 group-hover:opacity-15 group-hover:scale-[3.2] transition-all duration-700 ease-out blur-xl`}
                                                />

                                                {/* Subtle Floating Bubble Particle */}
                                                <div
                                                    className={`pointer-events-none absolute top-3 right-8 w-6 h-6 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-[1px] group-hover:scale-150 group-hover:opacity-35 transition-all duration-500`}
                                                />

                                                {/* Interactive Ring Highlight */}
                                                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-blue-500/0 group-hover:ring-blue-500/30 transition-all duration-500" />

                                                <div>
                                                    {/* Header: Icon + Badge */}
                                                    <div className="relative z-10 flex items-start justify-between gap-3">
                                                        <div
                                                            className={`relative z-10 h-14 w-14 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shrink-0`}
                                                        >
                                                            <IconComp className="h-7 w-7 drop-shadow-sm text-white" strokeWidth={2.3} />
                                                        </div>
                                                        {isServiceReady ? (
                                                            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-900 border-emerald-300 shadow-2xs">
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border bg-slate-100 text-black border-slate-300 shadow-2xs">
                                                                Configurable
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Category Title - High Contrast Dark Black */}
                                                    <h3 className="relative z-10 mt-4 text-[15px] font-black text-black group-hover:text-blue-700 transition-colors leading-snug">
                                                        {cat.name}
                                                    </h3>

                                                    {/* Short Category Description - Dark and Clearly Readable */}
                                                    <p className="relative z-10 mt-1.5 text-[12px] font-bold text-slate-800 line-clamp-2 leading-relaxed">
                                                        {cat.description || `Configure percentage commission for ${cat.name}`}
                                                    </p>
                                                </div>

                                                {/* Footer Action */}
                                                <div className="relative z-10 mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-blue-700 group-hover:text-blue-800 transition-colors">
                                                    <span>Configure Plans</span>
                                                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1.5" />
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* ── STEP 2 (OR AEPS 1): 2-COLUMN VIEW ─────────────────────── */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* ── LEFT COLUMN: Model Switcher & Service / Plan Selectors ── */}
                        <div className="lg:col-span-4 space-y-6">
                            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
                                {/* Commission Model Dropdown (Change 1) */}
                                {renderCommissionModelDropdown()}

                                {/* ── CASE 1: AEPS 1 SELECTOR ── */}
                                {commissionModel === 'AEPS_1' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-black uppercase tracking-wider block">
                                                Select Target Service
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={selectedService}
                                                    onChange={(e) => setSelectedService(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-2.5 text-xs font-black text-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all appearance-none cursor-pointer pr-9 shadow-2xs"
                                                >
                                                    {services.map(s => (
                                                        <option key={s.id} value={s.id}>{s.label}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
                                            </div>
                                        </div>

                                        {/* AEPS Plan Selector */}
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-black uppercase tracking-wider block">
                                                Select Commission Plan
                                            </label>
                                            <div className="flex flex-col gap-2">
                                                {plans.map(p => {
                                                    const isSelected = p.id === selectedPlanId;
                                                    const displayName = getAdminPlanDisplayName(p);
                                                    return (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() => handleSelectPlan(p)}
                                                            className={`w-full px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between gap-2 text-left cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-black text-white shadow-md shadow-slate-900/20 ring-2 ring-black'
                                                                    : 'bg-slate-50 text-black hover:bg-slate-100 border border-slate-300'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                {p.isDefault && <Sparkles size={13} className={isSelected ? 'text-amber-400' : 'text-amber-500'} />}
                                                                <span className="truncate">{displayName}</span>
                                                            </div>
                                                            {p.price > 0 ? (
                                                                <span className={`text-[10.5px] font-black px-2 py-0.5 rounded-lg shrink-0 ${
                                                                    isSelected ? 'bg-slate-800 text-indigo-200' : 'bg-slate-200 text-black'
                                                                }`}>
                                                                    &#8377;{Number(p.price).toLocaleString('en-IN')}
                                                                </span>
                                                            ) : (
                                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0 ${
                                                                    isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                                                                }`}>
                                                                    FREE
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* ── CASE 2: BBPS CONFIGURE SCREEN (Change 2) ── */}
                                {commissionModel === 'BBPS' && (
                                    <div className="space-y-5">
                                        {/* Target Service Bar with Change Action */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-black text-black uppercase tracking-wider block">
                                                    Target BBPS Service
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setBbpsStep('select-service')}
                                                    className="text-[10px] font-black uppercase text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer transition-colors"
                                                    title="Select another BBPS service"
                                                >
                                                    <RotateCcw size={11} />
                                                    Change Service
                                                </button>
                                            </div>

                                            {/* Compact active service card */}
                                            <div className="p-3 bg-slate-50 border border-slate-300 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
                                                        {React.createElement(selectedBbpsCategory.icon || HandCoins, { size: 16 })}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="text-xs font-black text-black truncate">
                                                            {selectedBbpsCategory.name}
                                                        </h3>
                                                        <span className="text-[9.5px] font-bold text-slate-700 font-mono">
                                                            id: {selectedBbpsCategory.id}
                                                        </span>
                                                    </div>
                                                </div>
                                                {isServiceActive ? (
                                                    <span className="text-[9px] font-black uppercase bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-2xs shrink-0">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-black uppercase bg-slate-200 text-black px-2 py-0.5 rounded-full shrink-0 border border-slate-300">
                                                        Configurable
                                                    </span>
                                                )}
                                            </div>

                                            {/* Quick Service Switcher Dropdown */}
                                            <div className="relative">
                                                <select
                                                    value={selectedBbpsServiceId}
                                                    onChange={(e) => handleSelectBbpsService(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2 text-xs font-black text-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all appearance-none cursor-pointer pr-8 shadow-2xs"
                                                >
                                                    {BBPS_CATEGORIES.map(cat => (
                                                        <option key={cat.id} value={cat.id}>
                                                            Switch to: {cat.name} {(cat.id === 'loan-repayment' || cat.id === 'electricity') ? '(Active)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
                                            </div>
                                        </div>

                                        {/* 4 Plans Selector for BBPS */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-black text-black uppercase tracking-wider block">
                                                    Select Commission Plan
                                                </label>
                                                <span className="text-[10px] font-black text-black">
                                                    {bbpsConfigs.length} Plans
                                                </span>
                                            </div>

                                            {loadingBbpsConfigs ? (
                                                <div className="p-8 text-center text-black flex flex-col items-center justify-center gap-2 bg-slate-50 rounded-2xl border border-slate-200">
                                                    <RefreshCw className="animate-spin text-blue-600" size={20} />
                                                    <span className="text-xs font-bold text-black">Loading plans...</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    {bbpsConfigs.map(cfg => {
                                                        const isSelected = cfg.planCode === selectedBbpsPlanCode;
                                                        const displayName = getBbpsPlanDisplayName(cfg);

                                                        return (
                                                            <button
                                                                key={cfg.id || cfg.planCode}
                                                                type="button"
                                                                onClick={() => handleSelectBbpsPlan(cfg.planCode)}
                                                                className={`w-full px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between gap-2 text-left cursor-pointer ${
                                                                    isSelected
                                                                        ? 'bg-black text-white shadow-md shadow-slate-900/20 ring-2 ring-black'
                                                                        : 'bg-slate-50 text-black hover:bg-slate-100 border border-slate-300'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    {cfg.planCode === 'FREE' && (
                                                                        <Sparkles size={13} className={isSelected ? 'text-amber-400' : 'text-amber-500'} />
                                                                    )}
                                                                    <span className="truncate">{displayName}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    {cfg.planPrice > 0 ? (
                                                                        <span className={`text-[10.5px] font-black px-2 py-0.5 rounded-lg ${
                                                                            isSelected ? 'bg-slate-800 text-emerald-300' : 'bg-slate-200 text-black'
                                                                        }`}>
                                                                            &#8377;{Number(cfg.planPrice).toLocaleString('en-IN')}
                                                                        </span>
                                                                    ) : (
                                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
                                                                            isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                                                                        }`}>
                                                                            FREE
                                                                        </span>
                                                                    )}
                                                                    <span className={`text-[9.5px] font-mono font-black px-1.5 py-0.5 rounded ${
                                                                        isSelected
                                                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                                                            : cfg.enabled ? 'bg-emerald-100 text-emerald-950 border border-emerald-300' : 'bg-rose-100 text-rose-950 border border-rose-300'
                                                                    }`}>
                                                                        {cfg.totalPercentage}%
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── RIGHT COLUMN: Configuration Editor ── */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* ── CASE 1: AEPS 1 SLAB EDITOR TABLE ── */}
                        {commissionModel === 'AEPS_1' && (
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-black text-black">
                                                {activePlan ? `${getAdminPlanDisplayName(activePlan)} Slabs` : 'Commission Slabs'}
                                            </h2>
                                            {activePlan?.isDefault && (
                                                <span className="bg-emerald-100 text-emerald-950 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300">
                                                    Default System Plan
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 mt-0.5">
                                            Commission is a fixed rupee amount granted per successful transaction slab.
                                        </p>
                                    </div>
                                </div>

                                {loadingPlans ? (
                                    <div className="p-12 text-center text-black flex flex-col items-center gap-2">
                                        <RefreshCw className="animate-spin text-blue-600" size={24} />
                                        <span className="text-xs font-bold text-black">Loading plans & slabs...</span>
                                    </div>
                                ) : slabs.length === 0 ? (
                                    <div className="p-12 text-center text-black">
                                        <p className="text-sm font-bold">No slabs configured for this plan.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-black text-black uppercase tracking-widest">
                                                        <th className="py-4 px-5">Slab Range (&#8377;)</th>
                                                        <th className="py-4 px-3 text-center">Retailer (&#8377;)</th>
                                                        <th className="py-4 px-3 text-center">Distributor (&#8377;)</th>
                                                        <th className="py-4 px-3 text-center">Super Distributor (&#8377;)</th>
                                                        <th className="py-4 px-3 text-center">Total Distributed</th>
                                                        <th className="py-4 px-5 text-right">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 text-xs font-bold text-black">
                                                    {slabs.map((slab, idx) => {
                                                        const ret = parseFloat(slab.retailerCommission) || 0;
                                                        const dist = parseFloat(slab.distributorCommission) || 0;
                                                        const sd = parseFloat(slab.superDistributorCommission) || 0;
                                                        const total = ret + dist + sd;
                                                        const isHighTotal = total > 20;

                                                        return (
                                                            <tr key={slab.id || idx} className="hover:bg-slate-50 transition-colors">
                                                                <td className="py-4 px-5">
                                                                    <span className="font-mono text-sm font-black text-black">
                                                                        &#8377;{Number(slab.minAmount).toLocaleString()} &ndash; &#8377;{Number(slab.maxAmount).toLocaleString()}
                                                                    </span>
                                                                </td>

                                                                {/* Retailer Edit */}
                                                                <td className="py-3 px-3 text-center">
                                                                    <div className="inline-flex items-center bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner">
                                                                        <span className="text-black font-black mr-1 text-xs">&#8377;</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.25"
                                                                            min="0"
                                                                            value={slab.retailerCommission}
                                                                            onChange={(e) => handleSlabChange(idx, 'retailerCommission', e.target.value)}
                                                                            className="w-16 bg-transparent text-sm font-black text-black text-center focus:outline-none"
                                                                        />
                                                                    </div>
                                                                </td>

                                                                {/* Distributor Edit */}
                                                                <td className="py-3 px-3 text-center">
                                                                    <div className="inline-flex items-center bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner">
                                                                        <span className="text-black font-black mr-1 text-xs">&#8377;</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.25"
                                                                            min="0"
                                                                            value={slab.distributorCommission}
                                                                            onChange={(e) => handleSlabChange(idx, 'distributorCommission', e.target.value)}
                                                                            className="w-16 bg-transparent text-sm font-black text-black text-center focus:outline-none"
                                                                        />
                                                                    </div>
                                                                </td>

                                                                {/* Super Distributor Edit */}
                                                                <td className="py-3 px-3 text-center">
                                                                    <div className="inline-flex items-center bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner">
                                                                        <span className="text-black font-black mr-1 text-xs">&#8377;</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.25"
                                                                            min="0"
                                                                            value={slab.superDistributorCommission}
                                                                            onChange={(e) => handleSlabChange(idx, 'superDistributorCommission', e.target.value)}
                                                                            className="w-16 bg-transparent text-sm font-black text-black text-center focus:outline-none"
                                                                        />
                                                                    </div>
                                                                </td>

                                                                {/* Total Commission */}
                                                                <td className="py-4 px-3 text-center">
                                                                    <div className="flex items-center justify-center gap-1.5">
                                                                        <span className="font-mono text-xs font-black text-black bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-300">
                                                                            &#8377;{total.toFixed(2)}
                                                                        </span>
                                                                        {isHighTotal && (
                                                                            <span title="High total commission warning" className="text-amber-500">
                                                                                <AlertTriangle size={14} />
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                {/* Active / Enabled */}
                                                                <td className="py-4 px-5 text-right">
                                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-950 border border-emerald-300">
                                                                        Active
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Footer Action Bar */}
                                        <div className="p-4 sm:p-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-end gap-4">
                                            {hasAepsChanges && (
                                                <span className="text-xs font-black text-amber-700 mr-auto">
                                                    You have unsaved changes in slab rates.
                                                </span>
                                            )}
                                            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                                {hasAepsChanges && (
                                                    <button
                                                        onClick={handleResetAeps}
                                                        disabled={saving}
                                                        className="px-4 py-2.5 rounded-2xl border border-slate-300 text-black text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-all flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <RotateCcw size={14} />
                                                        Reset
                                                    </button>
                                                )}
                                                <button
                                                    onClick={handleSaveAeps}
                                                    disabled={saving || !hasAepsChanges}
                                                    className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 text-white shadow-lg cursor-pointer ${
                                                        saving || !hasAepsChanges
                                                            ? 'bg-slate-300 shadow-none cursor-not-allowed text-slate-600'
                                                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                                                    }`}
                                                >
                                                    <Save size={14} />
                                                    {saving ? 'Saving...' : 'Save Plan'}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── CASE 2: BBPS PERCENTAGE COMMISSION CONFIGURATION ── */}
                        {commissionModel === 'BBPS' && (
                            <div className="space-y-6">
                                {/* Percentage Configuration Card */}
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                    {/* Header */}
                                    <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-lg font-black text-black">
                                                    {activeBbpsConfig ? `${getBbpsPlanDisplayName(activeBbpsConfig)} • ${activeBbpsConfig.serviceName}` : 'BBPS Percentage Commission'}
                                                </h2>
                                                {activeBbpsConfig?.planCode === 'FREE' && (
                                                    <span className="bg-emerald-100 text-emerald-950 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300">
                                                        Default Plan
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-bold text-slate-800 mt-0.5">
                                                Calculated as percentage (%) of the eligible BBPS transaction amount. No transaction slabs.
                                            </p>
                                        </div>

                                        {/* Status Toggle Switch */}
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-black text-black">
                                                Commission Status:
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setBbpsFormData(prev => ({ ...prev, enabled: !prev.enabled }))}
                                                className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                                    bbpsFormData.enabled
                                                        ? 'bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-xs'
                                                        : 'bg-rose-100 text-rose-950 border border-rose-300'
                                                }`}
                                            >
                                                {bbpsFormData.enabled ? (
                                                    <>
                                                        <CheckCircle2 size={14} className="text-emerald-700" />
                                                        Active
                                                    </>
                                                ) : (
                                                    <>
                                                        <ShieldAlert size={14} className="text-rose-700" />
                                                        Disabled
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Form Inputs Grid */}
                                    <div className="p-6 space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {/* 1. Retailer Percentage */}
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-300 space-y-2 flex flex-col justify-between">
                                                <div className="flex items-center justify-between gap-1">
                                                    <label className="text-[11px] font-black text-black uppercase tracking-wider truncate">
                                                        Retailer (%)
                                                    </label>
                                                    <span className="text-[9px] font-black uppercase bg-blue-100 text-blue-950 px-2 py-0.5 rounded border border-blue-300 shrink-0">
                                                        Direct
                                                    </span>
                                                </div>
                                                <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-2 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner">
                                                    <input
                                                        type="number"
                                                        step="0.05"
                                                        min="0"
                                                        max="100"
                                                        value={bbpsFormData.retailerPercentage}
                                                        onChange={(e) => { const v = e.target.value; const num = parseFloat(v) || 0; setBbpsFormData(prev => ({ ...prev, retailerPercentage: v, enabled: num > 0 ? true : prev.enabled })); }}
                                                        className="w-full bg-transparent text-sm sm:text-base font-black text-black focus:outline-none min-w-0"
                                                    />
                                                    <Percent size={14} className="text-black shrink-0 ml-1 font-black" />
                                                </div>
                                                <p className="text-[9.5px] sm:text-[10px] font-bold text-slate-800 leading-tight">
                                                    Granted to the transaction-initiating retailer.
                                                </p>
                                            </div>

                                            {/* 2. Distributor Percentage */}
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-300 space-y-2 flex flex-col justify-between">
                                                <div className="flex items-center justify-between gap-1">
                                                    <label className="text-[11px] font-black text-black uppercase tracking-wider truncate">
                                                        Distributor (%)
                                                    </label>
                                                    <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-950 px-2 py-0.5 rounded border border-amber-300 shrink-0">
                                                        Upline 1
                                                    </span>
                                                </div>
                                                <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-2 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner">
                                                    <input
                                                        type="number"
                                                        step="0.05"
                                                        min="0"
                                                        max="100"
                                                        value={bbpsFormData.distributorPercentage}
                                                        onChange={(e) => { const v = e.target.value; const num = parseFloat(v) || 0; setBbpsFormData(prev => ({ ...prev, distributorPercentage: v, enabled: num > 0 ? true : prev.enabled })); }}
                                                        className="w-full bg-transparent text-sm sm:text-base font-black text-black focus:outline-none min-w-0"
                                                    />
                                                    <Percent size={14} className="text-black shrink-0 ml-1 font-black" />
                                                </div>
                                                <p className="text-[9.5px] sm:text-[10px] font-bold text-slate-800 leading-tight">
                                                    Credited to immediate parent distributor if mapped.
                                                </p>
                                            </div>

                                            {/* 3. Super Distributor Percentage */}
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-300 space-y-2 flex flex-col justify-between">
                                                <div className="flex items-center justify-between gap-1">
                                                    <label className="text-[11px] font-black text-black uppercase tracking-wider truncate">
                                                        Super Dist. (%)
                                                    </label>
                                                    <span className="text-[9px] font-black uppercase bg-purple-100 text-purple-950 px-2 py-0.5 rounded border border-purple-300 shrink-0">
                                                        Upline 2
                                                    </span>
                                                </div>
                                                <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-2 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner">
                                                    <input
                                                        type="number"
                                                        step="0.05"
                                                        min="0"
                                                        max="100"
                                                        value={bbpsFormData.superDistributorPercentage}
                                                        onChange={(e) => { const v = e.target.value; const num = parseFloat(v) || 0; setBbpsFormData(prev => ({ ...prev, superDistributorPercentage: v, enabled: num > 0 ? true : prev.enabled })); }}
                                                        className="w-full bg-transparent text-sm sm:text-base font-black text-black focus:outline-none min-w-0"
                                                    />
                                                    <Percent size={14} className="text-black shrink-0 ml-1 font-black" />
                                                </div>
                                                <p className="text-[9.5px] sm:text-[10px] font-bold text-slate-800 leading-tight">
                                                    Credited to super distributor in hierarchy branch.
                                                </p>
                                            </div>

                                            {/* 4. Total Calculation Div (Combined Commission Payout) */}
                                            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white space-y-2 flex flex-col justify-between shadow-md border border-slate-800">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-[11px] font-black uppercase text-indigo-200 tracking-wider truncate">
                                                        Combined Payout
                                                    </span>
                                                    <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-400/30 shrink-0 flex items-center gap-1">
                                                        <TrendingUp size={10} />
                                                        Total
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2 border border-white/10">
                                                    <span className="text-sm sm:text-base font-black font-mono text-emerald-400 truncate">
                                                        {bbpsTotalPercentage.toFixed(2)}%
                                                    </span>
                                                    {bbpsTotalPercentage > 5 && (
                                                        <span title="High total payout warning" className="text-amber-400 shrink-0">
                                                            <AlertTriangle size={15} />
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[9.5px] sm:text-[10px] font-bold text-slate-300 leading-tight">
                                                    Total distributed percentage across all hierarchy levels.
                                                </p>
                                            </div>
                                        </div>

                                        {/* ── LIVE INTERACTIVE CALCULATOR / SIMULATOR ── */}
                                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-300 space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                                                <div className="flex items-center gap-2">
                                                    <Calculator size={16} className="text-blue-700" />
                                                    <h3 className="text-xs font-black text-black uppercase tracking-wider">
                                                        Live Percentage Calculation Simulator
                                                    </h3>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black text-black">Sample Amount:</span>
                                                    <div className="inline-flex items-center bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-black text-black">
                                                        <span className="text-black font-black mr-1">&#8377;</span>
                                                        <input
                                                            type="number"
                                                            step="100"
                                                            min="1"
                                                            value={simulatedAmount}
                                                            onChange={(e) => setSimulatedAmount(e.target.value)}
                                                            className="w-20 bg-transparent text-right font-black text-black focus:outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Calculated outputs */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                                <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-2xs">
                                                    <span className="text-[9.5px] font-black text-slate-800 uppercase tracking-wider block">Retailer Earns</span>
                                                    <p className="text-sm font-black text-black font-mono mt-1">
                                                        &#8377;{simRetCommission.toFixed(2)}
                                                    </p>
                                                    <span className="text-[9px] font-black text-blue-700">({bbpsFormData.retailerPercentage}%)</span>
                                                </div>

                                                <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-2xs">
                                                    <span className="text-[9.5px] font-black text-slate-800 uppercase tracking-wider block">Distributor Earns</span>
                                                    <p className="text-sm font-black text-black font-mono mt-1">
                                                        &#8377;{simDistCommission.toFixed(2)}
                                                    </p>
                                                    <span className="text-[9px] font-black text-amber-800">({bbpsFormData.distributorPercentage}%)</span>
                                                </div>

                                                <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-2xs">
                                                    <span className="text-[9.5px] font-black text-slate-800 uppercase tracking-wider block">Super Dist. Earns</span>
                                                    <p className="text-sm font-black text-black font-mono mt-1">
                                                        &#8377;{simSdCommission.toFixed(2)}
                                                    </p>
                                                    <span className="text-[9px] font-black text-purple-800">({bbpsFormData.superDistributorPercentage}%)</span>
                                                </div>

                                                <div className="bg-black text-white p-3 rounded-xl shadow-xs">
                                                    <span className="text-[9.5px] font-bold text-slate-200 uppercase tracking-wider block">Total Disbursed</span>
                                                    <p className="text-sm font-black font-mono mt-1 text-emerald-400">
                                                        &#8377;{simTotalCommission.toFixed(2)}
                                                    </p>
                                                    <span className="text-[9px] font-bold text-emerald-300">({bbpsTotalPercentage.toFixed(2)}%)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div className="p-4 sm:p-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-end gap-4">
                                        {hasBbpsChanges && (
                                            <span className="text-xs font-black text-amber-700 mr-auto">
                                                You have unsaved percentage changes.
                                            </span>
                                        )}
                                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                            {hasBbpsChanges && (
                                                <button
                                                    onClick={handleResetBbps}
                                                    disabled={saving}
                                                    className="px-4 py-2.5 rounded-2xl border border-slate-300 text-black text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-all flex items-center gap-2 cursor-pointer"
                                                >
                                                    <RotateCcw size={14} />
                                                    Reset
                                                </button>
                                            )}
                                            <button
                                                onClick={handleSaveBbps}
                                                disabled={saving || !hasBbpsChanges}
                                                className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 text-white shadow-lg cursor-pointer ${
                                                    saving || !hasBbpsChanges
                                                        ? 'bg-slate-300 shadow-none cursor-not-allowed text-slate-600'
                                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                                                }`}
                                            >
                                                <Save size={14} />
                                                {saving ? 'Saving...' : 'Save Configuration'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )) : (
                /* ── AUDIT LEDGER TAB (AEPS & BBPS TRANSACTIONS) ───────────────────── */
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-black text-black">Commission Distribution Audit Ledger</h2>
                            <p className="text-xs font-bold text-slate-800 mt-0.5">
                                Permanent record of all distributed commissions, mapped transactions, beneficiaries, and role credits.
                            </p>
                        </div>

                        {/* Search and filters */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black" />
                                <input
                                    type="text"
                                    placeholder="Search Txn ID / Ref..."
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') fetchHistory(); }}
                                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-black placeholder:text-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 w-48 shadow-2xs"
                                />
                            </div>

                            {/* Service Filter */}
                            <select
                                value={historyServiceFilter}
                                onChange={(e) => setHistoryServiceFilter(e.target.value)}
                                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-black focus:outline-none cursor-pointer shadow-2xs"
                            >
                                <option value="ALL">All Services</option>
                                <option value="AEPS_1">AEPS 1 (Cash Withdrawal)</option>
                                <option value="BBPS_LOAN_REPAYMENT">BBPS (Loan Repayment)</option>
                                <option value="BBPS_ELECTRICITY">BBPS (Electricity)</option>
                                <option value="MOBILE_RECHARGE">Mobile Recharge</option>
                            </select>

                            <select
                                value={historyStatus}
                                onChange={(e) => setHistoryStatus(e.target.value)}
                                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-black focus:outline-none cursor-pointer shadow-2xs"
                            >
                                <option value="ALL">All Status</option>
                                <option value="SUCCESS">Success</option>
                                <option value="FAILED">Failed</option>
                            </select>

                            <button
                                onClick={fetchHistory}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 transition-colors cursor-pointer"
                                title="Refresh"
                            >
                                <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
                            </button>

                            <button
                                onClick={handleReconcileBbps}
                                disabled={reconciling}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-black transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                                title="Scan and credit missing commissions for successful BBPS transactions"
                            >
                                <Sparkles size={14} className={reconciling ? 'animate-spin text-emerald-600' : 'text-emerald-600'} />
                                <span>Reconcile BBPS</span>
                            </button>

                            <button
                                onClick={handleReconcileRecharge}
                                disabled={reconciling}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-black transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                                title="Scan and credit missing commissions for successful Mobile Recharge transactions"
                            >
                                <Sparkles size={14} className={reconciling ? 'animate-spin text-blue-600' : 'text-blue-600'} />
                                <span>Reconcile Recharge</span>
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-black text-black uppercase tracking-widest">
                                    <th className="py-3 px-4">Date & Time</th>
                                    <th className="py-3 px-4">Commission Ref</th>
                                    <th className="py-3 px-4">Original Txn ID</th>
                                    <th className="py-3 px-4">Service</th>
                                    <th className="py-3 px-4">Beneficiary</th>
                                    <th className="py-3 px-4">Role</th>
                                    <th className="py-3 px-4 text-right">Txn Amount</th>
                                    <th className="py-3 px-4 text-center">Rate / Slab</th>
                                    <th className="py-3 px-4 text-right">Commission</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-xs font-bold text-black">
                                {historyLoading ? (
                                    <tr>
                                        <td colSpan={10} className="py-12 text-center text-black">
                                            <RefreshCw className="animate-spin mx-auto mb-2 text-blue-600" size={20} />
                                            Loading commission transactions...
                                        </td>
                                    </tr>
                                ) : historyList.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-12 text-center text-black font-black">
                                            No commission transactions found for the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    historyList.map(item => {
                                        const isBbps = String(item.serviceType || '').includes('BBPS');
                                        const isRecharge = String(item.serviceType || '').includes('RECHARGE') || String(item.serviceType || '') === 'MR';
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="py-3 px-4 text-slate-800 font-mono text-[11px] whitespace-nowrap">
                                                    {new Date(item.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                                </td>
                                                <td className="py-3 px-4 font-mono font-black text-black">
                                                    {item.commissionReference}
                                                </td>
                                                <td className="py-3 px-4 font-mono font-bold text-slate-800">
                                                    {item.originalTransactionId}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase ${
                                                        isRecharge
                                                            ? 'bg-blue-100 text-blue-950 border border-blue-300'
                                                            : isBbps
                                                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                                                            : 'bg-indigo-100 text-indigo-950 border border-indigo-300'
                                                    }`}>
                                                        {isRecharge ? (
                                                            <>
                                                                <Smartphone size={10} className="text-blue-700" />
                                                                <span>{item.operatorName || item.operatorCode || 'Recharge'}</span>
                                                            </>
                                                        ) : isBbps ? (
                                                            item.bbpsCategory ? `BBPS ${item.bbpsCategory}` : (String(item.serviceType).includes('ELECTRICITY') ? 'BBPS Electricity' : 'BBPS Loan')
                                                        ) : 'AEPS 1'}
                                                    </span>
                                                    {isRecharge && item.mobileNo && (
                                                        <span className="block text-[10px] font-mono text-slate-500 mt-0.5">
                                                            {item.mobileNo}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 font-black text-black">
                                                    {item.beneficiaryName} <span className="text-slate-600 font-bold text-[10px]">({item.beneficiaryUsername})</span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                                                        item.beneficiaryRole === 'RETAILER'
                                                            ? 'bg-blue-100 text-blue-950 border border-blue-300'
                                                            : item.beneficiaryRole === 'DISTRIBUTOR'
                                                            ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                                            : 'bg-purple-100 text-purple-950 border border-purple-300'
                                                    }`}>
                                                        {item.beneficiaryRole}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-black text-black">
                                                    &#8377;{Number(item.transactionAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-3 px-4 text-center font-mono text-[11px]">
                                                    {isRecharge ? (
                                                        <span className="inline-block bg-blue-100 text-blue-950 border border-blue-300 px-2 py-0.5 rounded font-black">
                                                            {item.commissionMode === 'FIXED'
                                                                ? `₹${Number(item.appliedCommissionValue || 0).toFixed(2)} (Fixed)`
                                                                : `${Number(item.appliedCommissionValue || 0).toFixed(2)}%`}
                                                        </span>
                                                    ) : isBbps ? (
                                                        <span className="inline-block bg-emerald-100 text-emerald-950 border border-emerald-300 px-2 py-0.5 rounded font-black">
                                                            {item.appliedPercentage ? `${item.appliedPercentage}%` : item.slabRange}
                                                        </span>
                                                    ) : (
                                                        <span className="text-black font-bold">
                                                            {item.slabRange}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-black text-emerald-700">
                                                    +&#8377;{Number(item.commissionAmount).toFixed(2)}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-950 border border-emerald-300">
                                                        {item.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {historyTotal > historySize && (
                        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                            <span className="text-xs text-slate-800 font-bold">
                                Showing {historyPage * historySize + 1} to {Math.min((historyPage + 1) * historySize, historyTotal)} of {historyTotal} records
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                                    disabled={historyPage === 0}
                                    className="p-2 rounded-xl border border-slate-300 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-black"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-xs font-black text-black px-2">Page {historyPage + 1}</span>
                                <button
                                    onClick={() => setHistoryPage(p => p + 1)}
                                    disabled={(historyPage + 1) * historySize >= historyTotal}
                                    className="p-2 rounded-xl border border-slate-300 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-black"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
