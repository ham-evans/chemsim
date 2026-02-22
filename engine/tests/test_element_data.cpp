#include <gtest/gtest.h>
#include "chemsim/core/element_data.h"

using namespace chemsim;

TEST(ElementData, LookupByNumber) {
    const auto& h = element_by_number(1);
    EXPECT_EQ(h.symbol, "H");
    EXPECT_EQ(h.atomic_number, 1);
    EXPECT_NEAR(h.mass, 1.008, 0.01);
    EXPECT_GT(h.covalent_radius, 0.0);

    const auto& c = element_by_number(6);
    EXPECT_EQ(c.symbol, "C");

    const auto& o = element_by_number(8);
    EXPECT_EQ(o.symbol, "O");
}

TEST(ElementData, LookupBySymbol) {
    const auto& h = element_by_symbol("H");
    EXPECT_EQ(h.atomic_number, 1);

    const auto& c = element_by_symbol("C");
    EXPECT_EQ(c.atomic_number, 6);

    const auto& fe = element_by_symbol("Fe");
    EXPECT_EQ(fe.atomic_number, 26);
}

TEST(ElementData, InvalidLookup) {
    EXPECT_THROW(element_by_number(999), std::out_of_range);
    EXPECT_THROW(element_by_symbol("Xx"), std::out_of_range);
}

TEST(ElementData, CovalentRadii) {
    // H-O bond should be perceived from covalent radii
    const auto& h = element_by_number(1);
    const auto& o = element_by_number(8);
    double sum = h.covalent_radius + o.covalent_radius;
    EXPECT_GT(sum, 0.8);  // Should be ~0.97
    EXPECT_LT(sum, 1.3);
}
