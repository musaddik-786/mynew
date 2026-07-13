def get_coverages():
    return [
        {
            "clauseType": "coverage",
            "id": "GCPPropertyOffPrem",
            "pattern": {"id": "GCPPropertyOffPrem"},
            "terms": {
                "GCPPropertyOffPremDeductible": {"directValue": "50000.00"},
                "GCPPropertyOffPremInterContinent": {"directValue": "50000.00"},
                "GCPPropertyOffPremLimit": {"directValue": "400000.00"},
                "GCPPropertyOffPremWithinTerrLimit": {"directValue": "25000.00"}
            }
        }
        # {
        #     "clauseType": "coverage",
        #     "id": "GCPNewlyAcquiredBuildProp",
        #     "pattern": {"id": "GCPNewlyAcquiredBuildProp"},
        #     "terms": {}
        # },
        # {
        #     "clauseType": "coverage",
        #     "id": "GCPOutsideObjs",
        #     "pattern": {"id": "GCPOutsideObjs"},
        #     "terms": {
        #         "GCPOutsideObjsDeductible": {"directValue": "1.00"},
        #         "GCPOutsideObjsLimit": {"directValue": "2.00"}
        #     }
        # },
        # {
        #     "clauseType": "coverage",
        #     "id": "GCPContentsOtherStruct",
        #     "pattern": {"id": "GCPContentsOtherStruct"},
        #     "terms": {
        #         "GCPContentsOtherStructDeductible": {},
        #         "GCPContentsOtherStructLimit": {
        #             "typekeyValue": {"code": "TwoPercent", "name": "2%"}
        #         }
        #     }
        # },
        # {
        #     "clauseType": "coverage",
        #     "id": "GCPTerrorism",
        #     "pattern": {"id": "GCPTerrorism"},
        #     "terms": {}
        # },
        # {
        #     "clauseType": "coverage",
        #     "id": "GCPFungus",
        #     "pattern": {"id": "GCPFungus"},
        #     "terms": {
        #         "GCPFungusLimit": {"directValue": "20000.00"}
        #     }
        # },
        # {
        #     "clauseType": "coverage",
        #     "id": "GCPDebrisRem",
        #     "pattern": {"id": "GCPDebrisRem"},
        #     "terms": {
        #         "GCPDebrisRemInsuredPropLimit": {"choiceValue": {"code": "100kusd"}},
        #         "GCPDebrisRemInsuredPropPercent": {"typekeyValue": {"code": "25Percent"}},
        #         "GCPDebrisRemOtherPropertyLimit": {"choiceValue": {"code": "200kusd"}}
        #     }
        # },
        # {
        #     "clauseType": "coverage",
        #     "id": "GCPDeferredPay",
        #     "pattern": {"id": "GCPDeferredPay"},
        #     "terms": {
        #         "GCPDeferredPayLimit": {"choiceValue": {"code": "100kusd"}}
        #     }
        # },
        # {
        #     "clauseType": "coverage",
        #     "id": "GCPExtraExp",
        #     "pattern": {"id": "GCPExtraExp"},
        #     "terms": {
        #         "GCPExtraExpLimit": {"choiceValue": {"code": "75kusd"}}
        #     }
        # },
        # {
        #     "clauseType": "coverage",
        #     "id": "GCPFireorPolice",
        #     "pattern": {"id": "GCPFireorPolice"},
        #     "terms": {
        #         "GCPFireorPoliceLimit": {"choiceValue": {"code": "75kusd"}}
        #     }
        # },
        # {
        #     "clauseType": "coverage",
        #     "id": "GCPFireProtEquip",
        #     "pattern": {"id": "GCPFireProtEquip"},
        #     "terms": {
        #         "GCPFireProtEquipLimit": {"choiceValue": {"code": "50kusd"}}
        #     }
        # },
        # {
        #     "clauseType": "coverage",
        #     "id": "GCPFlucRawMat",
        #     "pattern": {"id": "GCPFlucRawMat"},
        #     "terms": {
        #         "GCPFlucRawMatLimit": {"choiceValue": {"code": "400kusd"}}
        #     }
        # }
    ]