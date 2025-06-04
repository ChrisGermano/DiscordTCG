const mongoose = require('mongoose');

const CARD_TYPES = {
    BLOOD: 'Blood',
    MIND: 'Mind',
    TIME: 'Time',
    TECH: 'Tech',
    ARCANE: 'Arcane',
    NECROTIC: 'Necrotic',
    DEITY: 'Deity'
};

const TYPE_STRENGTHS = {
    [CARD_TYPES.BLOOD]: {
        strong: [CARD_TYPES.MIND],
        weak: [CARD_TYPES.NECROTIC]
    },
    [CARD_TYPES.MIND]: {
        strong: [CARD_TYPES.TIME],
        weak: [CARD_TYPES.BLOOD]
    },
    [CARD_TYPES.TIME]: {
        strong: [CARD_TYPES.TECH],
        weak: [CARD_TYPES.MIND]
    },
    [CARD_TYPES.TECH]: {
        strong: [CARD_TYPES.ARCANE],
        weak: [CARD_TYPES.TIME]
    },
    [CARD_TYPES.ARCANE]: {
        strong: [CARD_TYPES.NECROTIC],
        weak: [CARD_TYPES.TECH]
    },
    [CARD_TYPES.NECROTIC]: {
        strong: [CARD_TYPES.BLOOD],
        weak: [CARD_TYPES.ARCANE]
    },
    [CARD_TYPES.DEITY]: {
        strong: [CARD_TYPES.BLOOD, CARD_TYPES.MIND, CARD_TYPES.TIME, CARD_TYPES.TECH, CARD_TYPES.ARCANE, CARD_TYPES.NECROTIC],
        weak: [CARD_TYPES.DEITY]
    }
};

const cardSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    rarity: { 
        type: String, 
        required: true,
        enum: ['common', 'uncommon', 'rare', 'legendary', 'deity', 'fused']
    },
    type: {
        type: String,
        required: true,
        enum: Object.values(CARD_TYPES),
        validate: {
            validator: function(type) {
                // Deity type can only be used with deity rarity
                if (type === CARD_TYPES.DEITY && this.rarity !== 'deity') {
                    return false;
                }
                // Deity rarity must have deity type
                if (this.rarity === 'deity' && type !== CARD_TYPES.DEITY) {
                    return false;
                }
                return true;
            },
            message: props => {
                if (props.value === CARD_TYPES.DEITY) {
                    return 'Deity type can only be used with deity rarity cards';
                }
                return 'Deity rarity cards must have deity type';
            }
        }
    },
    set: { type: String, required: true },
    imageUrl: { type: String },
    special: { type: Boolean, default: false },
    power: { type: Number, default: 0 }
});

// Static method to check type effectiveness
cardSchema.statics.getTypeEffectiveness = function(attackerType, defenderType) {
    if (!TYPE_STRENGTHS[attackerType] || !TYPE_STRENGTHS[defenderType]) {
        throw new Error('Invalid card type');
    }

    // Deity is always strong against everything except other Deity
    if (attackerType === CARD_TYPES.DEITY) {
        return defenderType === CARD_TYPES.DEITY ? 'weak' : 'strong';
    }

    // Check if attacker is strong against defender
    if (TYPE_STRENGTHS[attackerType].strong.includes(defenderType)) {
        return 'strong';
    }
    // Check if attacker is weak against defender
    if (TYPE_STRENGTHS[attackerType].weak.includes(defenderType)) {
        return 'weak';
    }
    // Otherwise it's neutral
    return 'neutral';
};

module.exports = {
    Card: mongoose.model('Card', cardSchema),
    CARD_TYPES,
    TYPE_STRENGTHS
}; 