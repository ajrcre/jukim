package com.jukim.creepertrader.entity;

import net.minecraft.world.entity.player.Player;

/** State pattern: how the Creeper Trader behaves right now. */
public sealed interface TraderMood permits TraderMood.Peaceful, TraderMood.Fuse {
	TraderMood PEACEFUL = new Peaceful();

	boolean canTrade();

	/** Called every server tick. */
	TraderMood tick(CreeperTraderEntity trader);

	/** Called when a player hurts the trader. */
	TraderMood onHurtByPlayer(CreeperTraderEntity trader, Player attacker);

	/** Friendly trading state. */
	final class Peaceful implements TraderMood {
		@Override
		public boolean canTrade() {
			return true;
		}

		@Override
		public TraderMood tick(CreeperTraderEntity trader) {
			return this;
		}

		@Override
		public TraderMood onHurtByPlayer(CreeperTraderEntity trader, Player attacker) {
			trader.ignite(attacker);
			return new Fuse();
		}
	}

	/** Fuse is lit: chase the attacker until the creeper explodes. */
	final class Fuse implements TraderMood {
		private static final double CHASE_SPEED = 1.0;

		@Override
		public boolean canTrade() {
			return false;
		}

		@Override
		public TraderMood tick(CreeperTraderEntity trader) {
			if (trader.getTarget() != null) {
				trader.getNavigation().moveTo(trader.getTarget(), CHASE_SPEED);
				trader.getLookControl().setLookAt(trader.getTarget(), 30.0F, 30.0F);
			}
			return this;
		}

		@Override
		public TraderMood onHurtByPlayer(CreeperTraderEntity trader, Player attacker) {
			return this;
		}
	}
}
